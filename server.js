const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const {User, Department, Subject, Question, Option, Exam,Answer,Result} = require('./models/tables');
const { verifyToken, checkUserRole } = require('./middleware/authmiddleware');
const methodOverride = require('method-override');


const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
app.use(methodOverride('_method'));


app.get('/', async(req,res)=>{
  res.render('home-page');
});


app.get('/about-us', async(req,res)=>{
  res.render('about-us');
});




app.get('/login',async(req,res)=>{

res.render('Login');


});

app.get('/register-teacher', async(req,res)=>{

  res.render('Register')


});


app.get('/register-student', async(req,res)=>{

  res.render('registerstd')


});


app.get('/teacher-page', async(req,res)=>{

   res.render('TeacherPage');

});


app.get('/dashboard', async(req,res)=>{
    



  res.render('dashboard');

});



app.get('/exams', verifyToken, async (req, res) => {
  try {
    const exams = await Exam.findAll();

    // تأكد من تمرير message حتى لو لم يكن هناك امتحانات
    res.render('all-exams', { exams, message: exams.length > 0 ? null : "لا توجد امتحانات متاحة." });
  } catch (error) {
    console.error(error);
    res.status(500).render('all-exams', { exams: [], message: "حدث خطأ أثناء جلب الامتحانات." });
  }
});




// active exams endpoint
app.get('/active-exams', verifyToken, async (req, res) => {
  try {
    
    const user_name = req.user.user_name;
    const email = req.user.email;

    // استعلام للحصول على الامتحانات ذات الحالة "active"
    const exams = await Exam.findAll({ where: { examstate: 'active' } });

    // استخراج بيانات الامتحانات مع أسماء الأساتذة وعدد الأسئلة
    const examData = exams.map((exam) => ({
      examid: exam.examid,
      examname: exam.examname,
      examtime: exam.examtime,
      examstate: exam.examstate,
      professor_name: exam.professor_name,  // استخدام اسم المستخدم المستخرج من التوكن
      questionCount: exam.question_count // استخدام حقل question_count
    }));

    console.log(examData); // يمكنك إزالة هذا السطر بعد اختبار الكود

    // تمرير البيانات إلى القالب (template)
    res.render('studentPage', { exams: examData , user_name, email});
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Error fetching active exams." });
  }
});



app.get('/not-active-exams', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const inactiveExams = await Exam.findAll({ where: { examstate: 'not active' } });

    if (inactiveExams.length === 0) {
      return res.render('not-active-exams', { exams: [], message: 'لا توجد امتحانات غير نشطة' });
    }

    res.render('not-active-exams', { exams: inactiveExams, message: null });

  } catch (error) {
    console.error('Error fetching inactive exams:', error);
    res.status(500).send('حدث خطأ أثناء جلب الامتحانات.');
  }
});








app.get('/exams/:id', verifyToken, async (req, res) => {
  try {
    const userid = req.user.userid;
    const examid = req.params.id;

    // جلب بيانات الامتحان
    const exam = await Exam.findOne({ where: { examid } });
    if (!exam) {
      return res.status(404).render('error', { message: 'Exam not found' });
    }

    // جلب الأسئلة المرتبطة بالامتحان مع الخيارات
    const questions = await Question.findAll({ where: { examid } });
    const questionsWithOptions = await Promise.all(
      questions.map(async (question) => {
        const options = await Option.findAll({ where: { qid: question.qid } });
        return {
          ...question.toJSON(),
          options: options.map(option => option.toJSON()),
        };
      })
    );

    // عرض البيانات في قالب EJS
    return res.render('exam', {
      exam: exam.toJSON(),
      questions: questionsWithOptions,
      userid,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).render('error', { message: 'An error occurred while fetching the exam data.' });
  }
});








app.get('/results', verifyToken, async (req, res) => {
  try {
    const userid = req.user.userid; // استخراج userid من التوكن

    // جلب النتائج الخاصة بالمستخدم الحالي مع تفاصيل الامتحان
    const results = await Result.findAll({
      where: { userid }, // تصفية النتائج بناءً على userid
      include: [
        { model: User, attributes: ['user_name', 'email'] }, // جلب بيانات المستخدم
        { model: Exam, attributes: ['examname'] } // جلب بيانات الامتحان
      ],
      order: [['createdAt', 'DESC']], // ترتيب النتائج من الأحدث إلى الأقدم
    });

    res.render('results', { results }); // تمرير البيانات إلى ملف EJS
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).send('حدث خطأ أثناء جلب النتائج.');
  }
});




app.post('/answers',verifyToken, async (req, res) => {
  try {
    const { examid, userid, selected_option, text_answer } = req.body;
    console.log(req.body);

    if (!examid || !userid) {
      return res.status(400).json({ message: 'Missing required fields (examid or userid).' });
    }

    const correctOptions = await Option.findAll({
      attributes: ['opid'],
      where: { iscorrect: true },
      include: [{
        model: Question,
        where: { examid },
        attributes: []
      }]
    });

    const correctOptionIds = correctOptions.map(option => option.opid.toString());
    const selectedOptions = [];
    for (const [questionId, option] of Object.entries(selected_option)) {
      if (Array.isArray(option)) {
        selectedOptions.push(...option);
      } else {
        selectedOptions.push(option);
      }
    }

    let score = 0;
    selectedOptions.forEach(option => {
      if (correctOptionIds.includes(option)) {
        score += 1;
      }
    });

    // حفظ الإجابات في جدول Answer
    for (const [qid, options] of Object.entries(selected_option)) {
      const question = await Question.findOne({ where: { qid } });
      if (!question) {
        return res.status(404).json({ message: `Question with qid ${qid} not found.` });
      }

      if (question.qtype === 'multiple choice' || question.qtype === 'regular choice' || question.qtype === 'true/false') {
        if (Array.isArray(options)) {
          for (const opid of options) {
            const validOption = await Option.findOne({ where: { opid, qid } });
            if (!validOption) {
              return res.status(400).json({ message: `Invalid option ${opid} for question ${qid}.` });
            }

            await Answer.create({
              examid,
              userid,
              qid,
              selected_option: opid,
              is_correct: validOption.iscorrect,
            });
          }
        } else {
          const validOption = await Option.findOne({ where: { opid: options, qid } });
          if (!validOption) {
            return res.status(400).json({ message: `Invalid option ${options} for question ${qid}.` });
          }

          await Answer.create({
            examid,
            userid,
            qid,
            selected_option: options,
            is_correct: validOption.iscorrect,
          });
        }
      }

      if (question.qtype === 'fill in the blank') {
        const validOption = await Option.findOne({ where: { opid: options, qid } });
        if (!validOption) {
          return res.status(400).json({ message: `Invalid option ${options} for question ${qid}.` });
        }

        await Answer.create({
          examid,
          userid,
          qid,
          selected_option: options,
          is_correct: validOption.iscorrect,
        });
      }
    }

    for (const qid in text_answer) {
      const textAnswer = text_answer[qid];
      if (!textAnswer) {
        return res.status(400).json({ message: `Missing text answer for question ${qid}.` });
      }

      await Answer.create({
        examid,
        userid,
        qid,
        text_answer: textAnswer,
      });
    }

    // **حساب درجة النجاح**
    const totalQuestions = correctOptionIds.length; // عدد الأسئلة الصحيحة
    const passingScore = totalQuestions * 0.5; // نسبة النجاح 50%
    const passed = score >= passingScore; // هل اجتاز الامتحان؟

    // **حفظ النتيجة في جدول Results**
    await Result.create({
      userid,
      examid,
      total_score: score,
      passed
    });

    console.log(selectedOptions, correctOptionIds, score);
    
    res.status(200).json({
      message: 'Answers and result saved successfully.',
      selectedOptions,
      correctOptionIds,
      score,
      passed
    });
  } catch (error) {
    console.error('Error processing data:', error);
    res.status(500).json({ message: 'An error occurred while processing the data.' });
  }
});











app.post('/exams', verifyToken, async (req, res) => {
  try {
    const { exam, questions } = req.body;
    const professor_name = req.user.user_name; // استخراج اسم المستخدم من التوكن
    const subid = req.user.subid;

    // إنشاء الامتحان
    const newExam = await Exam.create({
      examname: exam.examname,
      examtime: exam.examtime,
      examstate: 'not active',
      subid: subid,
      professor_name: professor_name,
      question_count: exam.question_count
    });

    // حفظ الأسئلة
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const newQuestion = await Question.create({
        qtext: question.qtext,
        qtype: question.qtype,
        examid: newExam.examid
      });

      // حفظ الخيارات
      for (let j = 0; j < question.options.length; j++) {
        const option = question.options[j];
        await Option.create({
          optext: option.optext,
          iscorrect: option.iscorrect === 'true', // تحويل القيمة إلى boolean
          qid: newQuestion.qid
        });
      }
    }

    res.redirect('/teacher-page');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error creating exam');
  }
});


app.get('/exam/:id', verifyToken, async (req, res) => {
  try {
    const examid = req.params.id;
    const exam = await Exam.findByPk(examid);

    if (!exam) {
      return res.status(404).render('error', { message: 'Exam not found' });
    }

    res.render('edit-exams', { exam });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { message: 'An error occurred while fetching the exam.' });
  }
});







app.put('/exams/:id', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const examid = req.params.id;

    // التحقق مما إذا كان الامتحان موجودًا
    const exam = await Exam.findByPk(examid);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // استخراج البيانات المرسلة
    const { examname, examtime, examstate } = req.body;

    if (!examname?.trim() || !examtime?.trim() || !examstate) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // تحديث الامتحان
    await exam.update({ examname, examtime, examstate });

    res.json({ success: true, message: 'Exam updated successfully', exam });

  } catch (error) {
    console.error('Error updating exam:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});





// delete exam endpoint
app.delete('/exams/:id',verifyToken, checkUserRole('admin'), async (req, res) => {
  try {

    const examid = req.params.id;

    // البحث عن جميع الأسئلة المرتبطة بالامتحان
    const questions = await Question.findAll({ where: { examid: examid } });

    // حذف الخيارات المرتبطة بكل سؤال
    for (const question of questions) {
      await Option.destroy({ where: { qid: question.qid } });
    }

    // حذف جميع الأسئلة المرتبطة بالامتحان
    await Question.destroy({ where: { examid: examid } });

    // حذف الامتحان نفسه
    await Exam.destroy({ where: { examid: examid } });

    return res.status(200).send({ message: "Delete Exam Done" });

  } catch (error) {
    console.error(error);
    return res.status(400).send({ error: "An Error Happened" });
  }
});


// all users endpoint
app.get('/users', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const users = await User.findAll();
    // استدعاء صفحة EJS وتمرير بيانات المستخدمين إليها
    res.render('users', { users });
  } catch (error) {
    res.status(400).send({ error: "Error" });
  }
});



// find one user endpoint
app.get('/users/:id', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const userid = req.params.id;

    // البحث عن المستخدم
    const user = await User.findOne({ where: { userid: userid } });
    if (!user) {
      return res.status(404).send('User not found');
    }

    // جلب المواد والأقسام
    const subjects = await Subject.findAll();
    const departments = await Department.findAll();

    // عرض صفحة التعديل
    res.render('EditUser', { user, subjects, departments });
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while loading the edit page.');
  }
});




// show not active users endpoint
app.get('/not-active-users', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const not_active_users = await User.findAll({ where: { userstats: 'not active' } });
    // عرض صفحة EJS وتمرير البيانات إليها
    res.render('not-active-users', { users: not_active_users });
  } catch (error) {
    res.status(500).send({ error: "حدث خطأ أثناء جلب البيانات" });
  }
});



// تحديث حالة المستخدم إلى "active"
app.post('/activate-user/:id', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const userid = req.params.id;

    // تحديث حالة المستخدم
    await User.update({ userstats: 'active' }, { where: { userid } });

    // إعادة توجيه المستخدم إلى صفحة المستخدمين غير النشطين بعد التحديث
    res.redirect('/not-active-users');
  } catch (error) {
    res.status(500).send({ error: "حدث خطأ أثناء تحديث الحالة" });
  }
});




// update user endpoint
app.put('/users/:id',verifyToken, async (req, res) => {
  try {

    const userid = req.params.id;

    // البحث عن المستخدم
    const user = await User.findOne({ where: { userid: userid } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // استخراج البيانات من الطلب
    const { user_name, email, password, subname, deptname } = req.body;

    // العثور على القسم والمادة بناءً على الأسماء
    const user_department = await Department.findOne({ where: { deptname: deptname } });
    const user_subject = await Subject.findOne({ where: { subname: subname } });

    // التأكد من العثور على القسم والمادة
    if (!user_department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    if (!user_subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    // تحديث بيانات المستخدم
    await User.update(
      { 
        user_name, 
        email, 
        password, 
        subid: user_subject.subid, 
        deptid: user_department.deptid 
      },
      { where: { userid: userid } }
    );

    // إرجاع النتيجة
    const updatedUser = await User.findOne({ where: { userid: userid } });
    res.json(updatedUser);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while updating the user.' });
  }
});



// حذف المستخدم
app.post('/delete-user/:id', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const userid = req.params.id;

    // البحث عن المستخدم
    const user = await User.findOne({ where: { userid: userid } });

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // حذف المستخدم
    await User.destroy({ where: { userid: userid } });

    // إعادة التوجيه إلى صفحة المستخدمين بعد الحذف
    res.redirect('/users');

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف المستخدم.' });
  }
});



// teacher register endpoint
app.post('/teacher-register', async (req, res) => {
  const { user_name, email, password, subname, deptname } = req.body;

  // 1. التحقق من وجود جميع الحقول المطلوبة
  if (!user_name || !email || !password || !subname || !deptname) {
      return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
  }

  try {
      // 2. البحث عن القسم والمادة والتأكد من وجودهما
      const [user_department, user_subject] = await Promise.all([
          Department.findOne({ where: { deptname } }),
          Subject.findOne({ where: { subname } })
      ]);

      if (!user_department) {
          return res.status(404).json({ message: 'القسم غير موجود' });
      }
      if (!user_subject) {
          return res.status(404).json({ message: 'المادة غير موجودة' });
      }

      // 3. التحقق من عدم تكرار البريد الإلكتروني
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
          return res.status(409).json({ message: 'البريد الإلكتروني مسجل مسبقًا' });
      }

      // 4. تشفير كلمة المرور
      const hashedPassword = await bcrypt.hash(password, 10);

      // 5. إنشاء المستخدم الجديد
      await User.create({
          user_name,
          email,
          password: hashedPassword,
          usertype: 'teacher',
          subid: user_subject.subid,
          deptid: user_department.deptid
      });

      // 6. إعادة توجيه بعد التسجيل الناجح
      res.redirect('/login');

  } catch (error) {
      // 7. معالجة الأخطاء التفصيلية
      console.error('خطأ في تسجيل المدرس:', error);
      
      // تحديد نوع الخطأ لإرسال رسالة مناسبة
      const errorMessage = error.name === 'SequelizeUniqueConstraintError' 
          ? 'البريد الإلكتروني مسجل مسبقًا' 
          : 'حدث خطأ أثناء التسجيل';

      res.status(500).json({ 
          message: errorMessage,
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
  }
});


// student register endpoint
app.post('/student-register', async (req, res) => {
  const { user_name, email, password, deptname } = req.body;

  // 1. التحقق من وجود جميع الحقول المطلوبة
  if (!user_name || !email || !password || !deptname) {
      return res.status(400).json({ message: 'جميع الحقول مطلوبة' });
  }

  try {
      // 2. البحث عن القسم والتأكد من وجوده
      const user_department = await Department.findOne({ where: { deptname } });
      if (!user_department) {
          return res.status(404).json({ message: 'القسم غير موجود' });
      }

      // 3. التحقق من عدم تكرار البريد الإلكتروني
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
          return res.status(409).json({ message: 'البريد الإلكتروني مسجل مسبقًا' });
      }

      // 4. تشفير كلمة المرور
      const hashedPassword = await bcrypt.hash(password, 10);

      // 5. إنشاء المستخدم الجديد
      await User.create({
          user_name,
          email,
          password: hashedPassword,
          usertype: 'student',
          deptid: user_department.deptid
      });

      // 6. إعادة توجيه بعد التسجيل الناجح
      res.redirect('/login');

  } catch (error) {
      // 7. معالجة الأخطاء التفصيلية
      console.error('خطأ في تسجيل الطالب:', error);
      
      // تحديد نوع الخطأ لإرسال رسالة مناسبة
      const errorMessage = error.name === 'SequelizeUniqueConstraintError' 
          ? 'البريد الإلكتروني مسجل مسبقًا' 
          : 'حدث خطأ أثناء التسجيل';

      res.status(500).json({ 
          message: errorMessage,
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
  }
});


// login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // البحث عن المستخدم باستخدام البريد الإلكتروني
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // التحقق من كلمة المرور
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // إنشاء التوكن
    const token = jwt.sign(
      {
        userid: user.userid,
        user_name: user.user_name,
        email: user.email,
        usertype: user.usertype,
        subid: user.subid
      },
      'baqerali313', // هذا هو السر (secret)
      { expiresIn: '24h' } // التوكن سينتهي بعد 24 ساعة
    );

    // إعدادات الكوكيز مع الأمان
    res.cookie('token', token, {
      httpOnly: true, // هذا يعني أن الكوكيز غير قابل للوصول عبر جافا سكربت
      maxAge: 86400000, // مدة صلاحية الكوكيز (24 ساعة)
      sameSite: 'Strict', // يمكن تحديد sameSite لضمان أمان الكوكيز
      secure: process.env.NODE_ENV === 'production', // تفعيل secure في البيئة الإنتاجية فقط
    });

    // توجيه المستخدم بناءً على نوعه
    if (user.usertype === 'admin') {
      res.redirect('/dashboard');
    } else if (user.usertype === 'teacher') {
      res.redirect('/teacher-page');
    } else if (user.usertype === 'student') {
      res.redirect('/active-exams');
    }
  } catch (error) {
    console.error('Error logging in:', error);
    return res.status(500).json({ message: 'An error occurred while logging in', error });
  }
});



// عرض جميع الأقسام في صفحة EJS
app.get('/departments', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const departments = await Department.findAll();

    if (departments.length === 0) {
      return res.render('departments', { departments: [], message: 'لا توجد أقسام متاحة' });
    }

    res.render('departments', { departments, message: null });
  } catch (error) {
    console.error(error);
    res.status(500).send('حدث خطأ أثناء جلب الأقسام.');
  }
});



// find one department endpoint
app.get('/departments/:id', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const deptid = req.params.id;
    const department = await Department.findOne({ where: { deptid: deptid } });

    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.render('update-department', { department, message: '' }); // تم إضافة message هنا
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching the department.' });
  }
});


app.post('/departments',verifyToken, checkUserRole('admin'),async(req,res)=>{

try{

const { deptname, deptstages} = req.body;
if (!deptname || !deptstages) {
    return res.status(400).json({ message: 'All fields are required' });
}
  
const department = await Department.create({ deptname, deptstages });
return res.redirect('/departments');
}catch(error){
    console.log(error)
}
});


// update department endpoint
app.put('/departments/:id', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const deptid = req.params.id;

    // البحث عن القسم
    const department = await Department.findOne({ where: { deptid: deptid } });

    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // تحديث بيانات القسم
    const { deptname, deptstages } = req.body;

    await Department.update(
      { deptname, deptstages },
      { where: { deptid: deptid } }
    );

    // إرجاع النتيجة
    const updatedDepartment = await Department.findOne({ where: { deptid: deptid } });
    res.json(updatedDepartment);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while updating the department.' });
  }
});



// delete department endpoint 
app.delete('/departments/:id',verifyToken, checkUserRole('admin'), async (req, res) => {
  try {

  
    const deptid = req.params.id;

    // البحث عن القسم
    const department = await Department.findOne({ where: { deptid: deptid } });

    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    // حذف القسم
    await Department.destroy({ where: { deptid: deptid } });

    // إرجاع النتيجة
    res.redirect('/departments');
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "An error happened while deleting the department" });
  }
});



// عرض جميع المواد الدراسية في صفحة EJS
app.get('/subjects', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const subjects = await Subject.findAll();

    if (subjects.length === 0) {
      return res.render('subjects', { subjects: [], message: 'لا توجد مواد دراسية متاحة' });
    }

    res.render('subjects', { subjects, message: null });
  } catch (error) {
    console.error(error);
    res.status(500).send('حدث خطأ أثناء جلب المواد الدراسية.');
  }
});



// find one subject endpoint
app.get('/subjects/:id',verifyToken, checkUserRole('admin'), async (req, res) => {
  
  try {

    const subid = req.params.id;
    const subject = await Subject.findOne({ where: { subid: subid } });

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    res.render('update-subjects', { subject}); 
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching the subject.' });
  }
});



app.post('/subjects', verifyToken, checkUserRole('admin'),async(req,res)=>{


try {

const { subname, substage, subtype, deptname} = req.body;

if (!subname || !substage || !subtype || !deptname) {
    return res.status(400).json({ message: 'All fields are required' });
}
    const user_department = await Department.findOne({ where: { deptname } });
    const subject = await Subject.create({ subname, substage, subtype, deptid: user_department.deptid});
    return res.redirect('/subjects');
} catch (error) {
    console.log(error);
}

});


// update subject endpoint
app.put('/subjects/:id',verifyToken, checkUserRole('admin'), async (req, res) => {

  try {
    const subid = req.params.id;

    // البحث عن المادة
    const subject = await Subject.findOne({ where: { subid: subid } });

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    // تحديث بيانات المادة
    const { subname, substage, subtype, deptid } = req.body;

    await Subject.update(
      { subname, substage, deptid },
      { where: { subid: subid } }
    );

   res.redirect('/subjects');

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while updating the subject.' });
  }
});




// delete subject endpoint
app.delete('/subjects/:id',verifyToken, checkUserRole('admin'), async (req, res) => {

  try {


    const subid = req.params.id;

    // البحث عن المادة
    const subject = await Subject.findOne({ where: { subid: subid } });

    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    // حذف المادة
    await Subject.destroy({ where: { subid: subid } });

    // إرجاع النتيجة
    res.redirect('/subjects');  
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "An error happened while deleting the subject" });
  }
});



// عرض جميع الأسئلة في صفحة EJS
app.get('/questions', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const questions = await Question.findAll({
      include: Option, // تضمين الخيارات لكل سؤال
    });

    if (questions.length === 0) {
      return res.render('questions', { questions: [], message: 'لا توجد أسئلة متاحة' });
    }

    res.render('questions', { questions, message: null });
  } catch (error) {
    console.error(error);
    res.status(500).send('حدث خطأ أثناء جلب الأسئلة.');
  }
});




app.get('/questions/:id', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const qid = req.params.id;
    const question = await Question.findOne({
      where: { qid: qid },
      include: { model: Option }, // تضمين الخيارات المرتبطة بالسؤال
    });

    if (!question) {
      return res.render('question-details', { question: null, message: 'السؤال غير موجود' });
    }

    res.render('question-details', { question, message: null });
  } catch (error) {
    console.error(error);
    res.status(500).send('حدث خطأ أثناء جلب السؤال.');
  }
});





app.put('/questions/:id', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const qid = req.params.id;
    const { text, options, correctOptionIds } = req.body;

    console.log("Received data:", { text, options, correctOptionIds });

    // تحديث نص السؤال
    await Question.update(
      { qtext: text },
      { where: { qid: qid } }
    );

    // تحديث الخيارات
    for (let i = 0; i < options.length; i++) {
      const optionText = options[i];
      const correctOption = correctOptionIds.find(c => Number(c.oidx) === i); // تحويل oidx إلى رقم عند البحث

      if (correctOption) { 
        if (correctOption.oid) { 
          await Option.update(
            { 
              optext: optionText, // تحديث نص الخيار
              iscorrect: correctOption.iscorrect // تحديث حالة الخيار الصحيح
            },
            { 
              where: { 
                qid: qid, // ربط الخيار بالسؤال
                opid: correctOption.oid // استخدام opid لتحديد الخيار الصحيح
              } 
            }
          );
        } else {
          console.error(`Missing 'oid' for correctOption at index ${i}:`, correctOption);
        }
      } else {
        console.warn(`No matching correctOption found for index ${i}`);
      }
    }

    res.status(200).json({ message: 'Question updated successfully.' });
  } catch (error) {
    console.error("Error details:", error);
    res.status(500).json({ error: 'An error occurred while updating the question.' });
  }
});







// delete question endpoint
app.delete('/questions/:id', verifyToken, checkUserRole('admin'),async (req, res) => {
  
  try {

    
    const qid = req.params.id;

    // البحث عن السؤال
    const question = await Question.findOne({ where: { qid: qid } });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // حذف السؤال
    await Question.destroy({ where: { qid: qid } });

    res.status(200).json({ message: 'Question deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while deleting the question.' });
  }
});



// all options endpoint
app.get('/options', verifyToken, checkUserRole('admin'),async (req, res) => {

  try {


    const options = await Option.findAll();
    res.json(options);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching options.' });
  }
});

// find one option endpoint
app.get('/options/:id', verifyToken, checkUserRole('admin'),async (req, res) => {
  try {

    
    const qid = req.params.id;
    const options = await Option.findAll({ where: { qid: qid } });
    res.json(options);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching options.' });
  }
});


// // update option endpoint
// app.put('/options/:id', verifyToken, checkUserRole('admin'),async (req, res) => {
 
//   try {

    
//     const opid = req.params.id;
//     const { optext, iscorrect } = req.body;

//     // البحث عن الخيار
//     const option = await Option.findOne({ where: { opid: opid } });

//     if (!option) {
//       return res.status(404).json({ error: 'Option not found' });
//     }

//     // تحديث بيانات الخيار
//     await Option.update(
//       { optext: optext, iscorrect: iscorrect },
//       { where: { opid: opid } }
//     );

//     res.status(200).json({ message: 'Option updated successfully.' });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'An error occurred while updating the option.' });
//   }
// });



// delete option endpoint
app.delete('/options/:id',verifyToken, checkUserRole('admin'), async (req, res) => {

  try {


    const opid = req.params.id;

    // البحث عن الخيار
    const option = await Option.findOne({ where: { opid: opid } });

    if (!option) {
      return res.status(404).json({ error: 'Option not found' });
    }

    // حذف الخيار
    await Option.destroy({ where: { opid: opid } });

    res.status(200).json({ message: 'Option deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while deleting the option.' });
  }
});



const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

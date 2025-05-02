const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const {User, Department, Subject, Question, Option, Exam,Answer,Result} = require('./models/tables');
const { verifyToken, checkUserRole } = require('./middleware/authmiddleware');
const methodOverride = require('method-override');
const session = require('express-session');
const app = express();






app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.json());
app.use(methodOverride('_method'));
app.use(session({
  secret: 'baqerali313',
  resave: false,
  saveUninitialized: false,
  cookie: { 
      
      maxAge: 24 * 60 * 60 * 1000 // 24 ساعة
  }
}));






app.get('/', async(req,res)=>{
  res.render('home-page');
});


app.get('/about-us', async(req,res)=>{
  res.render('about-us');
});


app.get('/add-departments',verifyToken, async(req,res)=>{
  res.render('add-departments');
});

app.get('/login',async(req,res)=>{

res.render('Login');


});

app.get('/register-teacher', async(req,res)=>{
// جلب جميع الأقسام من قاعدة البيانات
const departments = await Department.findAll();
const subjects = await Subject.findAll();
  res.render('Register', { departments, subjects });


});


app.get('/register-student', async(req,res)=>{
// جلب جميع الأقسام من قاعدة البيانات
const departments = await Department.findAll();

  res.render('registerstd', { departments });


});


app.get('/teacher-page',verifyToken ,async(req,res)=>{


  const userid = req.user.userid;
  // جلب بيانات المستخدم الحالي
const user = await User.findOne({
  where: { userid },
  attributes: ['user_name', 'email']
});



   res.render('TeacherPage',{user_name: user.user_name, // تمرير user_name
    email: user.email,userid }); // تمرير email

});



app.get('/add-subjects', async (req, res) => {
  try {
      // جلب جميع الأقسام من قاعدة البيانات
      const departments = await Department.findAll();
      
      // عرض صفحة إضافة مادة مع تمرير بيانات الأقسام
      res.render('add-subjects', { departments });
  } catch (error) {
      console.error("حدث خطأ أثناء جلب الأقسام:", error);
      res.render('error-page', {
        message: "حدث خطأ أثناء جلب الأقسام.",
        errorCode: "INTERNAL_SERVER_ERROR"
    });
  }
});



app.get('/dashboard', async(req,res)=>{
    



  res.render('dashboard');

});



app.get('/exams', verifyToken, async (req, res) => {
  try {
    const exams = await Exam.findAll();

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
    const userid = req.user.userid;

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
    res.render('studentPage', { exams: examData , user_name, email,userid});
  } catch (error) {
    console.error(error);
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب الامتحانات.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
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
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب الامتحانات.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});








app.get('/exams/:id', verifyToken, async (req, res) => {
  try {
    const userid = req.user.userid;
    const examid = req.params.id;

    // جلب بيانات الامتحان
    const exam = await Exam.findOne({ where: { examid } });
    if (!exam) {
      return res.render('error-page', {
        message: "الامتحان غير موجود",
        errorCode: "NOT_FOUND"
    });
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
    const user = await User.findOne({
      where: { userid },
      attributes: ['user_name', 'email']
    });
    

    // عرض البيانات في قالب EJS
    return res.render('exam', {
      exam: exam.toJSON(),
      questions: questionsWithOptions,
      userid,
      user_name: user.user_name, // تمرير user_name
      email: user.email 
    });
  } catch (error) {
    console.error(error);
    return res.render('error-page', {
      message: "حدث خطأ أثناء جلب البيانات",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
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

    // جلب بيانات المستخدم الحالي
    const user = await User.findOne({
      where: { userid },
      attributes: ['user_name', 'email']
    });

    res.render('results', { 
      results,
      user_name: user.user_name, // تمرير user_name
      email: user.email // تمرير email
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب النتائج.",
      errorCode: "INTERNAL_SERVER_ERROR"
    });
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
    res.render('error-page', {
      message: "حدث خطأ أثناء حفظ الامتحان",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});


app.get('/exam/:id', verifyToken, async (req, res) => {
  try {
    const examid = req.params.id;
    const exam = await Exam.findByPk(examid);

    if (!exam) {
      return res.render('error-page', {
        message: "الامتحان غير موجود",
        errorCode: "NOT_FOUND"
    });
    }

    res.render('edit-exams', { exam });
  } catch (error) {
    console.error(error);
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب البيانات",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});







app.put('/exams/:id', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const examid = req.params.id;

    // التحقق مما إذا كان الامتحان موجودًا
    const exam = await Exam.findByPk(examid);
    if (!exam) {
      return res.render('error-page', {
        message: "الامتحان غير موجود",
        errorCode: "NOT_FOUND"
    });
    }

    // استخراج البيانات المرسلة
    const { examname, examtime, examstate } = req.body;

    if (!examname?.trim() || !examtime?.trim() || !examstate) {
      return res.render('error-page', {
        message: "البيانات المرسلة غير صحيحة",
        errorCode: "BAD_REQUEST"
    });
    }

    // تحديث الامتحان
    await exam.update({ examname, examtime, examstate });

    res.json({ success: true, message: 'Exam updated successfully', exam });

  } catch (error) {
    console.error('Error updating exam:', error);
    res.render('error-page', {
      message: "حدث خطأ أثناء تحديث الامتحان",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
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
    res.render('error-page', {
      message: "حدث خطأ أثناء حذف الامتحان",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});


// all users endpoint
app.get('/users', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const users = await User.findAll();
    // استدعاء صفحة EJS وتمرير بيانات المستخدمين إليها
    res.render('users', { users });
  } catch (error) {
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب البيانات",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});



// find one user endpoint
app.get('/users/:id', verifyToken, async (req, res) => {
  try {
    const userid = req.params.id;

    // البحث عن المستخدم
    const user = await User.findOne({ where: { userid: userid } });
    if (!user) {
      return res.render('error-page', {
        message: "المستخدم غير موجود",
        errorCode: "NOT_FOUND"
    });
    }

    // جلب المواد والأقسام
    const subjects = await Subject.findAll();
    const departments = await Department.findAll();

    // عرض صفحة التعديل
    res.render('EditUser', { user, subjects, departments });
  } catch (error) {
    console.error(error);
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب البيانات",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});




// show not active users endpoint
app.get('/not-active-users', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const not_active_users = await User.findAll({ where: { userstats: 'not active' } });
    // عرض صفحة EJS وتمرير البيانات إليها
    res.render('not-active-users', { users: not_active_users });
  } catch (error) {
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب البيانات",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
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
    res.render('error-page', {
      message: "حدث خطأ أثناء تحديث حالة المستخدم",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});




// update user endpoint
app.put('/users/:id',verifyToken, async (req, res) => {
  try {

    const userid = req.params.id;

    // البحث عن المستخدم
    const user = await User.findOne({ where: { userid: userid } });

    if (!user) {
      return res.render('error-page', {
        message: "المستخدم غير موجود",
        errorCode: "NOT_FOUND"
    });
    }

    // استخراج البيانات من الطلب
    const { user_name, email, password, subname, deptname } = req.body;

    // العثور على القسم والمادة بناءً على الأسماء
    const user_department = await Department.findOne({ where: { deptname: deptname } });
    const user_subject = await Subject.findOne({ where: { subname: subname } });

    // التأكد من العثور على القسم والمادة
    if (!user_department) {
      return res.render('error-page', {
        message: "القسم غير موجود",
        errorCode: "NOT_FOUND"
    });
    }
    if (!user_subject) {
      return res.render('error-page', {
        message: "المادة غير موجودة",
        errorCode: "NOT_FOUND"
    });
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
    res.json({updatedUser});

  } catch (error) {
    console.error(error);
    res.render('error-page', {
      message: "حدث خطأ أثناء تحديث البيانات",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});



// حذف المستخدم
app.post('/delete-user/:id', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const userid = req.params.id;

    // البحث عن المستخدم
    const user = await User.findOne({ where: { userid: userid } });

    if (!user) {
      res.render('error-page', {
        message: "المستخدم غير موجود",
        errorCode: "NOT_FOUND"
    });
    }

    // حذف المستخدم
    await User.destroy({ where: { userid: userid } });

    // إعادة التوجيه إلى صفحة المستخدمين بعد الحذف
    res.redirect('/users');

  } catch (error) {
    console.error(error);
    res.render('error-page', {
      message: "حدث خطأ أثناء حذف المستخدم",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});



// teacher register endpoint
app.post('/teacher-register', async (req, res) => {
  const { user_name, email, password, subname, deptname } = req.body;

  // 1. التحقق من وجود جميع الحقول المطلوبة
  if (!user_name || !email || !password || !subname || !deptname) {
      return res.render('error-page', {
        message: "جميع الحقول مطلوبة",
        errorCode: "BAD_REQUEST"
    });
  }

  try {
      // 2. البحث عن القسم والمادة والتأكد من وجودهما
      const [user_department, user_subject] = await Promise.all([
          Department.findOne({ where: { deptname } }),
          Subject.findOne({ where: { subname } })
      ]);

      if (!user_department) {
          return res.render('error-page', {
            message: "القسم غير موجود",
            errorCode: "NOT_FOUND"
        });
      }
      if (!user_subject) {
          return res.render('error-page', {
            message: "المادة غير موجودة",
            errorCode: "NOT_FOUND"
        });
      }

      // 3. التحقق من عدم تكرار البريد الإلكتروني
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
          return res.render('error-page', {
            message: "البريد الإلكتروني مسجل مسبقًا",
            errorCode: "CONFLICT"
        });
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
    res.render('error-page', {
      message: "حدث خطأ أثناء تسجيل المعلم",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});


// student register endpoint
app.post('/student-register', async (req, res) => {
  const { user_name, email, password, deptname } = req.body;

  // 1. التحقق من وجود جميع الحقول المطلوبة
  if (!user_name || !email || !password || !deptname) {
      return res.render('error-page', {
        message: "جميع الحقول مطلوبة",
        errorCode: "BAD_REQUEST"
    });
  }

  try {
      // 2. البحث عن القسم والتأكد من وجوده
      const user_department = await Department.findOne({ where: { deptname } });
      if (!user_department) {
          return res.render('error-page', {
            message: "القسم غير موجود",
            errorCode: "NOT_FOUND"
        });
      }

      // 3. التحقق من عدم تكرار البريد الإلكتروني
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
          return res.render('error-page', {
            message: "البريد الإلكتروني مسجل مسبقًا",
            errorCode: "CONFLICT"
        });
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
    res.render('error-page', {
      message: "حدث خطأ أثناء تسجيل الطالب",
      errorCode: "INTERNAL_SERVER_ERROR"
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
      return res.render('error-page', {
        message: "البريد الإلكتروني غير مسجل",
        errorCode: "NOT_FOUND"
    });
    }

    // التحقق من كلمة المرور
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.render('error-page', {
        message: "كلمة المرور غير صحيحة",
        errorCode: "UNAUTHORIZED"
    });
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
      'baqerali313', 
      { expiresIn: '24h' } // التوكن سينتهي بعد 24 ساعة
    );

    // إعدادات الكوكيز مع الأمان
    res.cookie('token', token, {
      httpOnly: true, // هذا يعني أن الكوكيز غير قابل للوصول عبر جافا سكربت
      maxAge: 86400000, // مدة صلاحية الكوكيز (24 ساعة)
      sameSite: 'Strict', // يمكن تحديد sameSite لضمان أمان الكوكيز
      
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
    return res.render('error-page', {
      message: "حدث خطأ أثناء تسجيل الدخول",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});



// تسجيل الخروج
app.get('/logout', (req, res) => {
  try {
      // تدمير الجلسة
      req.session.destroy((err) => {
          if (err) {
              console.error('Error destroying session:', err);
              return res.render('error-page', {
                message: "حدث خطأ أثناء تسجيل الخروج",
                errorCode: "INTERNAL_SERVER_ERROR"
            });
          }
          
          // مسح كوكي الجلسة
          res.clearCookie('token'); // أو اسم الكوكي الذي تستخدمه
          
          // إعادة توجيه إلى صفحة تسجيل الدخول
          res.redirect('/login');
      });
  } catch (error) {
      console.error('Error during logout:', error);
      res.render('error-page', {
        message: "حدث خطأ أثناء تسجيل الخروج",
        errorCode: "INTERNAL_SERVER_ERROR"
    });
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
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب الأقسام.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});



// find one department endpoint
app.get('/departments/:id', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const deptid = req.params.id;
    const department = await Department.findOne({ where: { deptid: deptid } });

    if (!department) {
      return res.render('error-page', {
        message: "القسم غير موجود",
        errorCode: "NOT_FOUND"
    });
    }

    res.render('update-department', { department, message: '' }); // تم إضافة message هنا
  } catch (error) {
    console.error(error);
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب القسم.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});


app.post('/departments',verifyToken, checkUserRole('admin'),async(req,res)=>{

try{

const { deptname, deptstages} = req.body;
if (!deptname || !deptstages) {
    return res.render('error-page', {
      message: "جميع الحقول مطلوبة",
      errorCode: "BAD_REQUEST"
  });
}
  
const department = await Department.create({ deptname, deptstages });
return res.redirect('/departments');
}catch(error){
  res.render('error-page', {
    message: "حدث خطأ أثناء إنشاء القسم.",
    errorCode: "INTERNAL_SERVER_ERROR"
});
}
});


// update department endpoint
app.put('/departments/:id', verifyToken, checkUserRole('admin'), async (req, res) => {
  try {
    const deptid = req.params.id;

    // البحث عن القسم
    const department = await Department.findOne({ where: { deptid: deptid } });

    if (!department) {
      return res.render('error-page', {
        message: "القسم غير موجود",
        errorCode: "NOT_FOUND"
    });
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
    res.render('error-page', {
      message: "حدث خطأ أثناء تحديث القسم.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});



// delete department endpoint 
app.delete('/departments/:id', async (req, res) => {
  try {
      const { id } = req.params;

      const deletedDepartment = await Department.destroy({
          where: { deptid: id }
      });

      if (!deletedDepartment) {
        res.render('error-page', {
          message: "حدث خطأ أثناء حذف القسم.",
          errorCode: "INTERNAL_SERVER_ERROR"
      });
      }

      res.status(200).json({ message: "تم حذف القسم بنجاح" });
  } catch (error) {
      console.error("حدث خطأ أثناء الحذف:", error);
      res.render('error-page', {
        message: "حدث خطأ أثناء حذف القسم.",
        errorCode: "INTERNAL_SERVER_ERROR"
    });
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
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب المواد الدراسية.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});



// find one subject endpoint
app.get('/subjects/:id',verifyToken, checkUserRole('admin'), async (req, res) => {
  
  try {

    const subid = req.params.id;
    const subject = await Subject.findOne({ where: { subid: subid } });

    if (!subject) {
      return res.render('error-page', {
        message: "المادة غير موجودة",
        errorCode: "NOT_FOUND"
    });
    }

    res.render('update-subjects', { subject}); 
  } catch (error) {
    console.error(error);
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب المادة.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});



app.post('/subjects', verifyToken, checkUserRole('admin'),async(req,res)=>{


try {

const { subname, substage, deptid} = req.body;

if (!subname || !substage || !deptid) {
    return res.render('error-page', {
      message: "جميع الحقول مطلوبة",
      errorCode: "BAD_REQUEST"
  });
}
    const user_department = await Department.findOne({ where: { deptid } });
    const subject = await Subject.create({ subname, substage, deptid: user_department.deptid});
    return res.redirect('/subjects');
} catch (error) {
    console.log(error);
    res.render('error-page', {
      message: "حدث خطأ أثناء إنشاء المادة.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
}

});


// update subject endpoint
app.put('/subjects/:id',verifyToken, checkUserRole('admin'), async (req, res) => {

  try {
    const subid = req.params.id;

    // البحث عن المادة
    const subject = await Subject.findOne({ where: { subid: subid } });

    if (!subject) {
      return res.render('error-page', {
        message: "المادة غير موجودة",
        errorCode: "NOT_FOUND"
    });
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
    res.render('error-page', {
      message: "حدث خطأ أثناء تحديث المادة.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});




// delete subject endpoint
app.delete('/subjects/:id',verifyToken, checkUserRole('admin'), async (req, res) => {

  try {


    const subid = req.params.id;

    // البحث عن المادة
    const subject = await Subject.findOne({ where: { subid: subid } });

    if (!subject) {
      return res.render('error-page', {
        message: "المادة غير موجودة",
        errorCode: "NOT_FOUND"
    });
    }

    // حذف المادة
    await Subject.destroy({ where: { subid: subid } });

    // إرجاع النتيجة
    res.status(200).json({ message: 'Subject deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.render('error-page', {
      message: "حدث خطأ أثناء حذف المادة.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
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
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب الأسئلة.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
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
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب السؤال.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
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
          res.render('error-page', {
            message: `Missing 'oid' for correctOption at index ${i}:`,
            errorCode: "INTERNAL_SERVER_ERROR"
        });
          
        }
      } else {
        res.render('error-page', {
          message: `No matching correctOption found for index ${i}`,
          errorCode: "INTERNAL_SERVER_ERROR"
      });
      }
    }

    res.status(200).json({ message: 'Question updated successfully.' });
  } catch (error) {
    console.error("Error details:", error);
    res.render('error-page', {
      message: "حدث خطأ أثناء تحديث السؤال.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});







// delete question endpoint
app.delete('/questions/:id', verifyToken, checkUserRole('admin'),async (req, res) => {
  
  try {

    
    const qid = req.params.id;

    // البحث عن السؤال
    const question = await Question.findOne({ where: { qid: qid } });

    if (!question) {
      return res.render('error-page', {
        message: "السؤال غير موجود",
        errorCode: "NOT_FOUND"
    });
    }

    // حذف السؤال
    await Question.destroy({ where: { qid: qid } });

    res.status(200).json({ message: 'Question deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.render('error-page', {
      message: "حدث خطأ أثناء حذف السؤال.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});



// all options endpoint
app.get('/options', verifyToken, checkUserRole('admin'),async (req, res) => {

  try {


    const options = await Option.findAll();
    res.json(options);
  } catch (error) {
    console.error(error);
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب الخيارات.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
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
    res.render('error-page', {
      message: "حدث خطأ أثناء جلب الخيار.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});




// delete option endpoint
app.delete('/options/:id',verifyToken, checkUserRole('admin'), async (req, res) => {

  try {


    const opid = req.params.id;

    // البحث عن الخيار
    const option = await Option.findOne({ where: { opid: opid } });

    if (!option) {
      return res.render('error-page', {
        message: "الخيار غير موجود",
        errorCode: "NOT_FOUND"
    });
    }

    // حذف الخيار
    await Option.destroy({ where: { opid: opid } });

    res.status(200).json({ message: 'Option deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.render('error-page', {
      message: "حدث خطأ أثناء حذف الخيار.",
      errorCode: "INTERNAL_SERVER_ERROR"
  });
  }
});



const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

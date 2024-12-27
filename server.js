const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const {User, Department, Subject, Question, Option, Exam,Answer} = require('./models/tables');
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


app.get('/login',async(req,res)=>{

res.render('Login');


});

app.get('/register', async(req,res)=>{

  res.render('Register')


});


app.get('/teacher-page', async(req,res)=>{

   res.render('TeacherPage');


});




// all exams endpoint
app.get('/exams',verifyToken , async(req,res)=>{    
  
  try{
    
  const exam = await Exam.findAll();
  return res.status(200).json(exam)
  }catch{
    res.status(400).send({message:"There`s No Active Exam..."})
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


app.get('/teachers/:id/edit', verifyToken, async (req, res) => {
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




app.post('/answers', async (req, res) => {
  try {
    const { examid, userid, selected_option, text_answer } = req.body;

    console.log(req.body); // طباعة البيانات المرسلة للمراجعة

    // التأكد من وجود examid و userid
    if (!examid || !userid) {
      return res.status(400).json({ message: 'Missing required fields (examid or userid).' });
    }

    // معالجة الأسئلة وإجاباتها
    for (const [qid, option] of selected_option) {
      // جلب السؤال بناءً على qid
      const question = await Question.findOne({ where: { qid } });
      if (!question) {
        return res.status(404).json({ message: `Question with qid ${qid} not found.` });
      }

      // إذا كانت الإجابة خيار متعدد أو خيار واحد
      if (question.qtype === 'multiple choice' || question.qtype === 'regular choice') {
        // تحقق من صحة الخيار المحدد
        const validOption = await Option.findOne({ where: { opid: option, qid } });
        if (!validOption) {
          return res.status(400).json({ message: `Invalid option ${option} for question ${qid}.` });
        }

        await Answer.create({
          examid,
          userid,
          qid,
          selected_option: option,
          is_correct: validOption.iscorrect,
        });
      }

      // إذا كان السؤال من نوع "املأ الفراغ" (دراغ أند دروب)
      if (question.qtype === 'fill in the blank') {
        // تحقق من صحة الخيار المرسل
        const validOption = await Option.findOne({ where: { opid: option, qid } });
        if (!validOption) {
          return res.status(400).json({ message: `Invalid option ${option} for question ${qid}.` });
        }

        await Answer.create({
          examid,
          userid,
          qid,
          selected_option: option,
          is_correct: validOption.iscorrect,
        });
      }
    }

    // معالجة الإجابات النصية
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

    res.status(201).json({ message: 'Answers saved successfully.' });
  } catch (error) {
    console.error('Error saving answer:', error);
    res.status(500).json({ message: 'An error occurred while saving the answer.' });
  }
});










// التعامل مع طلبات POST لإنشاء الامتحان
app.post('/exams',verifyToken, async (req, res) => {
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
          iscorrect: option.iscorrect,
          qid: newQuestion.qid
        });
      }
    }

    res.send('ok');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error creating exam');
  }
});








// update exam endpoint
app.put('/exams/:id',verifyToken, checkUserRole('teacher'), async (req, res) => {
  try {

    const examid = req.params.id;
    
    // البحث عن الامتحان
    const exam = await Exam.findOne({ where: { examid: examid } });
    
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    // تحديث بيانات الامتحان
    const { examname, examtime, examstate } = req.body;

    await Exam.update(
      { examname, examtime, examstate },
      { where: { examid: examid } }
    );

    // إرجاع النتيجة
    const updatedExam = await Exam.findOne({ where: { examid: examid } });
    res.json(updatedExam);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while updating the exam.' });
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
app.get('/users',verifyToken, checkUserRole('admin'),async(req,res)=>{
  try{

  const users = await User.findAll();
  return res.status(200).json(users)
  }catch(error){
    res.status(400).send({error:"Error"})
  }

});


// find one user endpoint
app.get('/users/:id',verifyToken, checkUserRole('admin'),async(req,res)=>{
  try{

  const userid = req.params.id;
  const users = await User.findOne({where: {userid:userid}});
  return res.status(200).json(users)
  }catch(error){
    res.status(400).send({error: "There`s No User With This Id"})
  }

});



// show not active users endpoint
app.get('/not-active-users',verifyToken, checkUserRole('admin'),async(req,res)=>{

  try{

      const not_active_users = await User.findAll({ where: { userstats: 'not active' } });
      return res.status(200).json(not_active_users);

  }catch(error){
    res.status(500).send({error: "error"})
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



// delete user endpoint
app.delete('/users/:id',verifyToken, checkUserRole('admin'), async (req, res) => {
  try {


    const userid = req.params.id;

    // البحث عن المستخدم
    const user = await User.findOne({ where: { userid: userid } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // حذف المستخدم
    await User.destroy({ where: { userid: userid } });

    // إرجاع النتيجة
    res.json({ message: 'User deleted successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while deleting the user.' });
  }
});



// teacher register endpoint
app.post('/teacher-register', async(req, res) => {
    const { user_name, email, password, subname, deptname } = req.body;
    const user_department = await Department.findOne({ where: { deptname } });
    const user_subject = await Subject.findOne({ where: { subname } });

    if (!user_name || !email || !password || !subname || !deptname) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        // Check if the email already exists in the database
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const saltRounds = 10; 
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        const user = await User.create({ user_name, email, password: hashedPassword, usertype : 'teacher', subid: user_subject.subid, deptid: user_department.deptid });
            
        return res.status(200).json({ message: 'Register User Successfully' });

    } catch (error) {
        console.error('Error registering user:', error);
        return res.status(500).json({ message: 'An error occurred while registering user' });
    }
});


// student register endpoint
app.post('/student-register', async(req, res) => {
    const { user_name, email, password, deptname } = req.body;

    const user_department = await Department.findOne({ where: { deptname } });

    if (!user_name || !email || !password || !deptname) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        // Check if the email already exists in the database
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Hash the password before saving it to the database
        const saltRounds = 10; // Ensure saltRounds is a valid number
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        const user = await User.create({ user_name, email, password: hashedPassword, usertype : 'student', deptid: user_department.deptid });
            
        return res.status(200).json({ message: 'Register User Successfully' });

    } catch (error) {
        console.error('Error registering user:', error);
        return res.status(500).json({ message: 'An error occurred while registering user' });
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
              email:user.email,
              usertype: user.usertype,
              subid: user.subid 
          },
          'baqerali313', // هذا هو السر (secret)
          { expiresIn: '1h' } // التوكن سينتهي بعد ساعة
      );

      // إعدادات الكوكيز مع الأمان
      res.cookie('token', token, {
          httpOnly: true, // هذا يعني أن الكوكيز غير قابل للوصول عبر جافا سكربت
          maxAge: 3600000, // مدة صلاحية الكوكيز (1 ساعة)
          sameSite: 'Strict', // يمكن تحديد sameSite لضمان أمان الكوكيز
      });

      // إرسال استجابة ناجحة
      return res.status(200).json({ message: 'Login User Successfully' });
  } catch (error) {
      console.error('Error logging in:', error);
      return res.status(500).json({ message: 'An error occurred while logging in', error });
  }
});



// all departments endpoint
app.get('/departments',verifyToken, checkUserRole('admin'), async (req, res) => {
  try {

    const departments = await Department.findAll();
    res.json(departments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching departments.' });
  }
});


// find one department endpoint
app.get('/departments/:id',verifyToken, checkUserRole('admin'), async (req, res) => {
  try {


    const deptid = req.params.id;
    const department = await Department.findOne({ where: { deptid: deptid } });

    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json(department);
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
return res.status(200).json({message : ' Department Added Succesfully'})
}catch(error){
    console.log(error)
}
});


// update department endpoint
app.put('/departments/:id', verifyToken, checkUserRole('admin'),async (req, res) => {
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
    res.status(200).send({ message: "Delete Department Done" });

  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "An error happened while deleting the department" });
  }
});



// all subjects endpoint
app.get('/subjects',verifyToken, checkUserRole('admin'), async (req, res) => {
  try {

    const subjects = await Subject.findAll();
    res.json(subjects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching subjects.' });
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

    res.json(subject);
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
    return res.status(200).json({message : "Subject Added Succesfully"});
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
      { subname, substage, subtype, deptid },
      { where: { subid: subid } }
    );

    // إرجاع النتيجة
    const updatedSubject = await Subject.findOne({ where: { subid: subid } });
    res.json(updatedSubject);

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
    res.status(200).send({ message: "Delete Subject Done" });

  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "An error happened while deleting the subject" });
  }
});



// all questions endpoint
app.get('/questions',verifyToken, checkUserRole('admin'), async (req, res) => {

  try {


    const questions = await Question.findAll({
      include: Option // تضمين الخيارات المتعلقة بكل سؤال
    });
    res.json(questions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching questions.' });
  }
});



// find one question endpoint
app.get('/questions/:id', verifyToken, checkUserRole('admin'),async (req, res) => {

  try {

    const qid = req.params.id;
    const question = await Question.findOne({
      where: { qid: qid },
      include: Option // تضمين الخيارات المتعلقة بالسؤال المحدد
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json(question);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while fetching the question.' });
  }
});



// update question endpoint
app.put('/questions/:id', verifyToken, checkUserRole('admin'),async (req, res) => {

  try {


    const qid = req.params.id;
    const { qtext, qtype } = req.body;

    // البحث عن السؤال
    const question = await Question.findOne({ where: { qid: qid } });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // تحديث بيانات السؤال
    await Question.update(
      { qtext: qtext, qtype: qtype },
      { where: { qid: qid } }
    );

    res.status(200).json({ message: 'Question updated successfully.' });
  } catch (error) {
    console.error(error);
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


// update option endpoint
app.put('/options/:id', verifyToken, checkUserRole('admin'),async (req, res) => {
 
  try {

    
    const opid = req.params.id;
    const { optext, iscorrect } = req.body;

    // البحث عن الخيار
    const option = await Option.findOne({ where: { opid: opid } });

    if (!option) {
      return res.status(404).json({ error: 'Option not found' });
    }

    // تحديث بيانات الخيار
    await Option.update(
      { optext: optext, iscorrect: iscorrect },
      { where: { opid: opid } }
    );

    res.status(200).json({ message: 'Option updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while updating the option.' });
  }
});



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

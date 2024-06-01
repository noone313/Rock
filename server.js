const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const {User, Department, Subject, Question, Option, Exam} = require('./models/tables')


const app = express();
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


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
app.post('/login', async(req, res) => {
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

        if (!user.subid) {
            const token = jwt.sign({ userid: user.userid, usertype: user.usertype}, 'baqerali313');
            res.cookie('token', token, { httpOnly: true });
        } else{
            const token = jwt.sign({ userid: user.userid, usertype: user.usertype, subid: user.subid }, 'baqerali313');
            res.cookie('token', token, { httpOnly: true });
        }

        // إرسال استجابة ناجحة
        return res.status(200).json({message : 'Login User Succesfully'})
    } catch (error) {
        console.error('Error logging in:', error);
        return res.status(500).json({ message: 'An error occurred while logging in' });
    }
});



app.post('/departments',async(req,res)=>{
const { deptname, deptstages} = req.body;
if (!deptname || !deptstages) {
    return res.status(400).json({ message: 'All fields are required' });
}
try{
const department = await Department.create({ deptname, deptstages });
return res.status(200).json({message : ' Department Added Succesfully'})
}catch(error){
    console.log(error)
}
});



app.post('/subjects', async(req,res)=>{
const { subname, substage, subtype, deptname} = req.body;

if (!subname || !substage || !subtype || !deptname) {
    return res.status(400).json({ message: 'All fields are required' });
}

try {
    const user_department = await Department.findOne({ where: { deptname } });
    const subject = await Subject.create({ subname, substage, subtype, deptid: user_department.deptid});
    return res.status(200).json({message : "Subject Added Succesfully"});
} catch (error) {
    console.log(error);
}

});



app.post('/add-questions',async(req,res)=>{

    try {
        function decodeJWT(token) {
            try {
                const decoded = jwt.verify(token, 'baqerali313');
                return decoded;
            } catch (err) {
                console.error('Error decoding JWT:', err);
                return null;
            }
        }
    
        try {
            const token = req.cookies.token;
            if (!token) {
                return res.status(401).send('Token not provided');
            }
            const decoded = decodeJWT(token);
    
            if (!decoded) {
                return res.status(400).json({ error: 'Invalid token' });
            }
            if (decoded.usertype === 'student') {
                return res.status(400).json({ error: 'Invalid token' });
            }

            const {qtext, qanswer, qtype } = req.body.question;
            const options = req.body.options;


            const add_question = await Question.create({qtext, qanswer,
                 qtype,subid:decoded.subid});
            
            for (const option in options) {
                if (options.hasOwnProperty(option)) {
                  await Option.create({
                    optext: options[option],
                    qid: add_question.qid
                  });
                }
              }

            return res.status(200).json({message : "Added Succesfuly"})

        } catch (error) {
            console.error('Error decoding token:', error);
            return res.status(500).send('Internal Server Error');
        }
        
    } catch (error) {
        console.log(error)
    }
});



app.post('/exams', async(req,res)=>{
const {examname, examtime, examstate, subname} = req.body
const subid = await Subject.findOne({where : subname})
    if (!examname || !examtime || !examstate || !subname){
        return res.status(400).json({message : "All fields are required"});
    }

    try {
        const exam = await Exam.create({examname, examtime, examstate, subid: subid.subid});
        return res.status(200).json({message : "Exam Added Succesfuly"});

    } catch (error) {
        console.log(error)
    }
});



const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('postgresql://rock_owner:BE1iXewV3SND@ep-bold-night-a5dap4u2.us-east-2.aws.neon.tech/rock?sslmode=require');



const Department = sequelize.define("Department", {
  deptid: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  deptname: {
    type: DataTypes.STRING,
    allowNull: false
  },
  deptstages: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
});



const Subject = sequelize.define("Subject", {
  subid: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  subname: {
    type: DataTypes.STRING,
    allowNull: false
  },
  substage: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  
  deptid: {
    type: DataTypes.INTEGER,
  }

});

Department.hasMany(Subject, { foreignKey: 'deptid',  onDelete: 'CASCADE' })
Subject.belongsTo(Department, { foreignKey: 'deptid' })




const User = sequelize.define("User", {
  userid: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  user_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  usertype: {
    type: DataTypes.STRING,
    allowNull: false
  },
  userstats: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'not active'
  },
  subid: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  deptid: {
    type: DataTypes.INTEGER,
  }

});

Subject.hasMany(User, { foreignKey: 'subid', onDelete: 'CASCADE' });
User.belongsTo(Subject, { foreignKey: 'subid' });

Department.hasMany(User, { foreignKey: 'deptid', onDelete: 'CASCADE' });
User.belongsTo(Department, { foreignKey: 'deptid' });



const Exam = sequelize.define('Exam', {
  examid: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  examname: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  examtime: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  examstate: {
    type: DataTypes.STRING,
    defaultValue: "not active",
    allowNull: false
  },
  subid: {
    type: DataTypes.INTEGER
  },
  professor_name: {  // حقل اسم الأستاذ
    type: DataTypes.STRING,
    allowNull: true
  },
  question_count: {  // حقل عدد الأسئلة
    type: DataTypes.INTEGER,
    allowNull: true
  }
});

Subject.hasMany(Exam, { foreignKey: 'subid', onDelete: 'CASCADE' });
Exam.belongsTo(Subject, { foreignKey: 'subid' })



const Question = sequelize.define('Question', {
  qid: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  qtext: {
    type: DataTypes.STRING,
    allowNull: false
  },
  qtype: {
    type: DataTypes.STRING,
    allowNull: false
  },
  examid: {
    type: DataTypes.INTEGER
  }

});

Exam.hasMany(Question, { foreignKey: 'examid', onDelete: 'CASCADE' })
Question.belongsTo(Exam, { foreignKey: 'examid' })



const Option = sequelize.define('Option', {
  opid: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  optext: {
    type: DataTypes.STRING,
    allowNull: false
  },
  iscorrect: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  qid: {
    type: DataTypes.INTEGER
  }

});

Question.hasMany(Option, { foreignKey: 'qid', onDelete: 'CASCADE' });
Option.belongsTo(Question, { foreignKey: 'qid' });




const Answer = sequelize.define('Answer', {
  answerid: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'userid',
    }
  },
  examid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Exams',
      key: 'examid',
    }
  },
  qid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Questions',
      key: 'qid',
    }
  },
  selected_option: {
    type: DataTypes.INTEGER, // تخزين رقم الخيار الذي تم اختياره
    allowNull: true
  },
  is_correct: {
    type: DataTypes.BOOLEAN, // تحديد صحة الإجابة
    allowNull: true
  },
  text_answer: {
    type: DataTypes.TEXT, // تخزين الإجابة النصية للأسئلة المقالية
    allowNull: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
});

// العلاقات
User.hasMany(Answer, { foreignKey: 'userid', onDelete: 'CASCADE' });
Answer.belongsTo(User, { foreignKey: 'userid' });

Exam.hasMany(Answer, { foreignKey: 'examid', onDelete: 'CASCADE' });
Answer.belongsTo(Exam, { foreignKey: 'examid' });

Question.hasMany(Answer, { foreignKey: 'qid', onDelete: 'CASCADE' });
Answer.belongsTo(Question, { foreignKey: 'qid' });



const Result = sequelize.define("Result", {
  resultid: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users', 
      key: 'userid'
    }
  },
  examid: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Exams', 
      key: 'examid'
    }
  },
  total_score: {
    type: DataTypes.FLOAT, // درجة الطالب النهائية
    allowNull: false
  },
  passed: {
    type: DataTypes.BOOLEAN, // هل الطالب ناجح أم لا
    allowNull: false,
    defaultValue: false
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
});

// العلاقات بين الجداول
User.hasMany(Result, { foreignKey: 'userid', onDelete: 'CASCADE' });
Result.belongsTo(User, { foreignKey: 'userid' });

Exam.hasMany(Result, { foreignKey: 'examid', onDelete: 'CASCADE' });
Result.belongsTo(Exam, { foreignKey: 'examid' });



sequelize.sync({ alter: true }).then(() => {
  console.log('Database Created successfully.');
}).catch((error) => {
  console.error('Error synchronizing database:', error);
});







module.exports = { Department, User, Subject, Question, Option, Exam, Answer,Result };
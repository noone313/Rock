const {Sequelize, DataTypes} = require('sequelize');

const sequelize = new Sequelize('postgresql://rock_owner:xJqnMReUj3V5@ep-long-scene-a5gyvli2.us-east-2.aws.neon.tech/rock?sslmode=require');
 
  

  const Department = sequelize.define("Department",{
    deptid: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey:true
      },
      deptname:{
        type: DataTypes.STRING,
        allowNull:false
      },
      deptstages:{
        type:DataTypes.INTEGER,
        allowNull:false
      }
  });



const Subject = sequelize.define("Subject",{
subid:{
  type:DataTypes.INTEGER,
  autoIncrement:true,
  primaryKey:true
},
subname:{
  type:DataTypes.STRING,
  allowNull:false
},
substage:{
  type:DataTypes.INTEGER,
  allowNull:false
},
subtype:{
  type:DataTypes.STRING,
  allowNull:false
},
deptid:{
  type:DataTypes.INTEGER,
}

});

Department.hasMany(Subject,{foreignKey: 'deptid'})
Subject.belongsTo(Department, {foreignKey:'deptid'})




const User = sequelize.define("User", {
  userid:{
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey:true
  },
  user_name: {
    type: DataTypes.STRING,
    allowNull:false
  },
  email:{
      type:DataTypes.STRING,
      allowNull:false,
      unique:true
  },
  password:{
      type:DataTypes.STRING,
      allowNull:false
  },
  usertype:{
      type:DataTypes.STRING,
      allowNull:false
  },
  userstats:{
      type:DataTypes.STRING,
      allowNull:false,
      defaultValue:'not active'
  },
  subid:{
    type:DataTypes.INTEGER,
    allowNull:true
  },
  deptid:{
      type:DataTypes.INTEGER,
  }

});

Subject.hasMany(User, {foreignKey:'subid'});
User.belongsTo(Subject, {foreignKey:'subid'});

Department.hasMany(User, {foreignKey:'deptid'});
User.belongsTo(Department, {foreignKey:'deptid'});



const Exam = sequelize.define('Exam', {

  examid:{
    type:DataTypes.INTEGER,
    autoIncrement:true,
    primaryKey:true
  },
  examname:{
    type:DataTypes.STRING,
    allowNull:false,
  },
  examtime:{
    type:DataTypes.INTEGER,
    allowNull:false
  },
  examstate:{
    type:DataTypes.STRING,
    defaultValue: "not active",
    allowNull:false
  },
  subid:{
    type:DataTypes.INTEGER
  }


});

Subject.hasMany(Exam, { foreignKey:'subid'});
Exam.belongsTo(Subject, {foreignKey:'subid'})



const Question = sequelize.define('Question',{
qid:{
  type:DataTypes.INTEGER,
  autoIncrement:true,
  primaryKey:true
},
qtext:{
  type:DataTypes.STRING,
  allowNull:false
},
qtype:{
  type:DataTypes.STRING,
  allowNull:false
},
examid:{
  type:DataTypes.INTEGER
}

});

Exam.hasMany(Question, {foreignKey:'examid'})
Question.belongsTo(Exam,{foreignKey:'examid'})



const Option = sequelize.define('Option',{
opid:{
  type:DataTypes.INTEGER,
  autoIncrement:true,
  primaryKey:true
},
optext:{
  type:DataTypes.STRING,
  allowNull:false
},
iscorrect:{
  type: DataTypes.BOOLEAN,
    allowNull: true
},
qid:{
  type:DataTypes.INTEGER
}

});

Question.hasMany(Option, {foreignKey:'qid'});
Option.belongsTo(Question, {foreignKey:'qid'});




sequelize.sync({alter:true}).then(() => {
    console.log('Database Created successfully.');
  }).catch((error) => {
    console.error('Error synchronizing database:', error);
  });
  

module.exports={Department,User, Subject, Question, Option, Exam};
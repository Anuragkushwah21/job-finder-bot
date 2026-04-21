const mongoose=require('mongoose');

const userSchema=new mongoose.Schema({
chatId:{type:Number,unique:true},
step:{type:String,default:'ask_experience'},
experience:String,
skills:{type:[String],default:[]},
seenJobs:{type:[String],default:[]},
lastJobs:{
 type:[{
 title:String,
 company:String,
 url:String,
 description:String
 }],
 default:[]
},
currentJobIndex:{type:Number,default:0}
},{timestamps:true});

module.exports=mongoose.model('User',userSchema);
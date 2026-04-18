const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { v7: uuidv7 } = require('uuid');
const profiles = require('./database');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
function getAgeGroup(age){if(age<=12)return 'child';if(age<=19)return 'teenager';if(age<=59)return 'adult';return 'senior';}
app.post('/api/profiles',async(req,res)=>{
  const{name}=req.body;
  if(!name||name==='')return res.status(400).json({status:'error',message:'name is required and cannot be empty'});
  if(typeof name!=='string')return res.status(422).json({status:'error',message:'name must be a string'});
  const cleanName=name.toLowerCase().trim();
  const existing=profiles.find(p=>p.name===cleanName);
  if(existing)return res.status(200).json({status:'success',message:'Profile already exists',data:existing});
  try{
    const[genderRes,ageRes,nationRes]=await Promise.all([
      axios.get('https://api.genderize.io?name='+cleanName),
      axios.get('https://api.agify.io?name='+cleanName),
      axios.get('https://api.nationalize.io?name='+cleanName)
    ]);
    const genderData=genderRes.data;
    const ageData=ageRes.data;
    const nationData=nationRes.data;
    if(!genderData.gender||genderData.count===0)return res.status(502).json({status:'error',message:'Genderize returned an invalid response'});
    if(!ageData.age)return res.status(502).json({status:'error',message:'Agify returned an invalid response'});
    if(!nationData.country||nationData.country.length===0)return res.status(502).json({status:'error',message:'Nationalize returned an invalid response'});
    const gender=genderData.gender;
    const gender_probability=genderData.probability;
    const sample_size=genderData.count;
    const age=ageData.age;
    const age_group=getAgeGroup(age);
    const topCountry=nationData.country.reduce((a,b)=>a.probability>b.probability?a:b);
    const country_id=topCountry.country_id;
    const country_probability=topCountry.probability;
    const id=uuidv7();
    const created_at=new Date().toISOString();
    const profile={id,name:cleanName,gender,gender_probability,sample_size,age,age_group,country_id,country_probability,created_at};
    profiles.push(profile);
    return res.status(201).json({status:'success',data:profile});
  }catch(error){
    console.log('ERROR:',error.message);
    return res.status(502).json({status:'error',message:'Failed to reach upstream API'});
  }
});
app.get('/api/profiles',(req,res)=>{
  let{gender,country_id,age_group}=req.query;
  let result=[...profiles];
  if(gender)result=result.filter(p=>p.gender.toLowerCase()===gender.toLowerCase());
  if(country_id)result=result.filter(p=>p.country_id.toLowerCase()===country_id.toLowerCase());
  if(age_group)result=result.filter(p=>p.age_group.toLowerCase()===age_group.toLowerCase());
  return res.status(200).json({status:'success',count:result.length,data:result});
});
app.get('/api/profiles/:id',(req,res)=>{
  const profile=profiles.find(p=>p.id===req.params.id);
  if(!profile)return res.status(404).json({status:'error',message:'Profile not found'});
  return res.status(200).json({status:'success',data:profile});
});
app.delete('/api/profiles/:id',(req,res)=>{
  const index=profiles.findIndex(p=>p.id===req.params.id);
  if(index===-1)return res.status(404).json({status:'error',message:'Profile not found'});
  profiles.splice(index,1);
  return res.status(204).send();
});
app.listen(PORT,()=>console.log('Server running on port '+PORT));
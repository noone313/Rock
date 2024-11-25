document.addEventListener('DOMContentLoaded', function () {
    const btn_Login=document.getElementById('btn_Login');
    const btn_Register=document.getElementById('btn_Register');
       if(btn_Login){
       btn_Login.addEventListener('click',function(){
           window.location.href='login';
       });}
    
       else{
       btn_Register.addEventListener('click',function(){
           window.location.href ='register';
       });}
   });
   
   
   // Toggle the display of the dropdown menu when the profile icon is clicked
   document.getElementById('btn').addEventListener('click', function() {
       const dropdown = document.getElementById('card');
       dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
   
   });
   document.addEventListener('click', function(event) {
       const dropdown = document.getElementById('card');
       const userBtn = document.getElementById('btn');
       
       if (!dropdown.contains(event.target) && event.target !== userBtn) {
           dropdown.style.display = 'none';
       }
   });
   
   
   document.addEventListener('DOMContentLoaded', function () {
   const menuBtn=document.getElementById('menu-btn');
   const navLinks=document.getElementById('nav-links');
   const menuBtnIcon=menuBtn.querySelector('i');
   menuBtn.addEventListener("click",(e)=>{
       navLinks.classList.toggle("open");
   
       const isOpen=navLinks.classList.contains("open");
       menuBtnIcon.setAttribute("class", isOpen?"fa-solid fa-xmark":"fa-solid fa-bars");
   });
   
   navLinks.addEventListener("click",(e)=>{
       navLinks.classList.remove("open");
       menuBtnIcon.setAttribute("class","fa-solid fa-bars")
   })});
   
   
   
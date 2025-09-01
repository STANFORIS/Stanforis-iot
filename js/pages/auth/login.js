(() => {
  const loginBtn = document.getElementById('loginBtn');
  const email = document.getElementById('email');
  const password = document.getElementById('password');

  loginBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    loginBtn.disabled = true;
    loginBtn.innerText = 'Logging in...';

    try {
      await window.handleLogin(email.value.trim(), password.value.trim());
      // handleLogin already calls startSplash("dashboard")
      
    } catch (err) {
      console.error('Login failed:', err);
      alert('Login failed: ' + (err.message || 'Unknown error'));
      loginBtn.disabled = false;
      loginBtn.innerText = 'Login';
    }
  });

  // Signup link — splash-safe navigation
  document.getElementById('signup-link')?.addEventListener('click', () => {
    window.App.navigateTo('signup');
  });
})();














// // www\js\pages\auth\login.js



// (() => {
//   const loginBtn = document.getElementById('loginBtn');
//   const email = document.getElementById('email');
//   const password = document.getElementById('password');

//   loginBtn?.addEventListener('click', async (e) => {
//     e.preventDefault();
//     loginBtn.disabled = true;
//     loginBtn.innerText = 'Logging in...';

//     try {
//       await window.handleLogin(email.value.trim(), password.value.trim());
//     } catch (err) {
//       console.error('Login failed:', err);
//       alert('Login failed: ' + (err.message || 'Unknown error'));
//       loginBtn.disabled = false;
//       loginBtn.innerText = 'Login';
//     }
//   });

//   document.getElementById('signup-link')?.addEventListener('click', () => {
//     window.App.navigateTo('signup');
    
//   });
// })();

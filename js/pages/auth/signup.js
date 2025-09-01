(() => {
  const submitBtn = document.getElementById('submitBtn');
  const termsCheckbox = document.getElementById('terms');
  const firstName = document.getElementById('firstName');
  const secondName = document.getElementById('secondName');
  const nationalId = document.getElementById('nationalId');
  const registrationType = document.getElementById('registrationType');
  const email = document.getElementById('email');
  const password = document.getElementById('password');
  const ownerAvatar = document.getElementById('ownerAvatar');

  // Enable submit button
  termsCheckbox?.addEventListener('change', () => {
    submitBtn.disabled = !termsCheckbox.checked;
  });

  // Signup submit
  submitBtn?.addEventListener('click', async (e) => {
    e.preventDefault();

    const profileData = {
      firstName: firstName.value.trim(),
      secondName: secondName.value.trim(),
      nationalId: nationalId.value.trim(),
      registrationType: registrationType.value,
      email: email.value.trim(),
      createdAt: new Date().toISOString()
    };
    if (ownerAvatar?.files.length) profileData.avatarName = ownerAvatar.files[0].name;

    try {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Signing up...';

      await window.handleSignup(email.value, password.value, profileData);
      // handleSignup already calls startSplash("login")
      
    } catch (err) {
      console.error('Signup failed:', err);
      alert('Signup failed: ' + (err.message || 'Unknown error'));
      submitBtn.disabled = false;
      submitBtn.innerText = 'Submit';
    }
  });

  // Login link — splash-safe navigation
    document.getElementById('signup-link')?.addEventListener('click', () => {
    window.App.navigateTo('login');
  });

})();
































// // www\js\pages\auth\signup.js


// (() => {
//   const submitBtn = document.getElementById('submitBtn');
//   const termsCheckbox = document.getElementById('terms');
//   const firstName = document.getElementById('firstName');
//   const secondName = document.getElementById('secondName');
//   const nationalId = document.getElementById('nationalId');
//   const registrationType = document.getElementById('registrationType');
//   const email = document.getElementById('email');
//   const password = document.getElementById('password');
//   const ownerAvatar = document.getElementById('ownerAvatar');

//   // Enable submit button
//   termsCheckbox?.addEventListener('change', () => {
//     submitBtn.disabled = !termsCheckbox.checked;
//   });

//   // Signup submit
//   submitBtn?.addEventListener('click', async (e) => {
//     e.preventDefault();

//     const profileData = {
//       firstName: firstName.value.trim(),
//       secondName: secondName.value.trim(),
//       nationalId: nationalId.value.trim(),
//       registrationType: registrationType.value,
//       email: email.value.trim(),
//       createdAt: new Date().toISOString()
//     };

//     if (ownerAvatar?.files.length) profileData.avatarName = ownerAvatar.files[0].name;

//     try {
//       submitBtn.disabled = true;
//       submitBtn.innerText = 'Signing up...';

//       await window.handleSignup(email.value, password.value, profileData);

//     } catch (err) {
//       console.error('Signup failed:', err);
//       alert('Signup failed: ' + (err.message || 'Unknown error'));
//       submitBtn.disabled = false;
//       submitBtn.innerText = 'Submit';
//     }
//   });

//   // Login link
//   document.getElementById('login-link')?.addEventListener('click', () => {
//     window.App.navigateTo('login');
//     // startSplash("login");
//   });
// })();

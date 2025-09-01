App.on("page:ready:staff", async () => {
  const staffList = document.getElementById("staffList");
  
  async function loadStaff() {
    const staff = await apiCall.getStaff();
    staffList.innerHTML = staff.map(s => `
      <div class="staff-card">
        <img src="${s.avatar || 'img/avatar-placeholder.png'}" alt="avatar">
        <p>${s.name}</p>
        <p>${s.email}</p>
        <button onclick="deleteStaff('${s.id}')">Delete</button>
      </div>
    `).join("");
  }

  async function deleteStaff(id) {
    if (!confirm("Delete this staff?")) return;
    await apiCall.deleteStaff(id);
    loadStaff();
  }

  document.getElementById("staff-add-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = document.getElementById("staffName").value.trim();
    const email = document.getElementById("staffEmail").value.trim();
    const avatarFile = document.getElementById("staffAvatar").files[0];
    if (!name || !email) return alert("Name & Email required");
    
    let avatar = "img/avatar-placeholder.png";
    if (avatarFile) avatar = await apiCall.uploadFace(avatarFile, `staff-${Date.now()}`);
    
    await apiCall.addStaff({ name, email, avatar, role: "staff", createdAt: Date.now() });
    document.getElementById("staff-add-form").reset();
    loadStaff();
  });

  loadStaff();
});

document.addEventListener('DOMContentLoaded', () => {
    const loginPage = document.getElementById('login-page');
    const registerPage = document.getElementById('register-page');
    const membersPage = document.getElementById('members-page');
    
    const loginIdInput = document.getElementById('login-id');
    const btnLogin = document.getElementById('btn-login');
    
    const regIdInput = document.getElementById('reg-id');
    const regForm = document.getElementById('register-form');
    const btnCancelReg = document.getElementById('btn-cancel-reg');
    const regImageInput = document.getElementById('reg-image');
    const imagePreview = document.getElementById('image-preview');
    
    const btnOpenCamera = document.getElementById('btn-open-camera');
    const btnUploadImage = document.getElementById('btn-upload-image');
    const btnCapturePhoto = document.getElementById('btn-capture-photo');
    const btnSwitchCamera = document.getElementById('btn-switch-camera');
    const cameraContainer = document.getElementById('camera-container');
    const cameraVideo = document.getElementById('camera-video');
    const cameraCanvas = document.getElementById('camera-canvas');

    let currentStream = null;
    let currentFacingMode = 'environment';
    
    const btnLogout = document.getElementById('btn-logout');
    const membersList = document.getElementById('members-list');
    const loadingMembers = document.getElementById('loading-members');

    let base64Image = '';

    const isNumeric13 = (val) => {
        return /^\d{13}$/.test(val);
    };

    const showPage = (pageElement) => {
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
            page.classList.add('hidden');
        });
        pageElement.classList.remove('hidden');
        pageElement.classList.add('active');
    };

    // Helper to call GAS backend API via fetch
    async function callGAS(action, params = {}, isPost = false) {
        if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL === 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL') {
            throw new Error('กรุณาตั้งค่า GAS_WEB_APP_URL ในไฟล์ index.html (บรรทัด script) ก่อนใช้งานเว็บแอป');
        }

        if (isPost) {
            // Using POST via plain text to bypass direct CORS Preflight blocks in Google Apps Script
            const response = await fetch(GAS_WEB_APP_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({ action: action, data: params })
            });
            return await response.json();
        } else {
            // Using GET
            const queryParams = new URLSearchParams({ action: action, ...params }).toString();
            const response = await fetch(`${GAS_WEB_APP_URL}?${queryParams}`);
            return await response.json();
        }
    }

    // LOGIN LOGIC
    btnLogin.addEventListener('click', async () => {
        const personId = loginIdInput.value.trim();
        if (!isNumeric13(personId)) {
            Swal.fire('ข้อผิดพลาด', 'กรุณากรอกรหัสบัตรประชาชน 13 หลัก ให้ถูกต้อง (เฉพาะตัวเลข)', 'error');
            return;
        }

        Swal.fire({
            title: 'กำลังตรวจสอบข้อมูล...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const result = await callGAS('checkMember', { personId: personId }, false);
            Swal.close();
            
            if (result.error) {
                Swal.fire('เกิดข้อผิดพลาด', result.error, 'error');
                return;
            }

            if (result.found) {
                loadMembers();
                showPage(membersPage);
            } else {
                Swal.fire({
                    title: 'ไม่พบข้อมูล',
                    text: 'คุณยังไม่ได้ลงทะเบียน กรุณาลงทะเบียนใหม่',
                    icon: 'info',
                    confirmButtonText: 'ตกลง'
                }).then(() => {
                    regIdInput.value = personId;
                    showPage(registerPage);
                });
            }
        } catch (error) {
            Swal.fire('เกิดข้อผิดพลาดในการเชื่อมต่อ', error.message || String(error), 'error');
        }
    });

    // REGISTRATION LOGIC
    btnUploadImage.addEventListener('click', () => {
        stopCamera();
        cameraContainer.style.display = 'none';
        regImageInput.click();
    });

    btnOpenCamera.addEventListener('click', async () => {
        if (currentStream) {
            stopCamera();
            cameraContainer.style.display = 'none';
            return;
        }
        await startCamera();
    });

    btnSwitchCamera.addEventListener('click', async () => {
        currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
        await startCamera();
    });

    async function startCamera() {
        stopCamera();
        try {
            currentStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: currentFacingMode }
            });
            cameraVideo.srcObject = currentStream;
            cameraContainer.style.display = 'block';
            imagePreview.style.display = 'none';
            base64Image = '';
        } catch (err) {
            Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบสิทธิ์การเข้าถึงกล้อง', 'error');
        }
    }

    function stopCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
    }

    btnCapturePhoto.addEventListener('click', () => {
        if (!currentStream) return;
        cameraCanvas.width = cameraVideo.videoWidth;
        cameraCanvas.height = cameraVideo.videoHeight;
        const ctx = cameraCanvas.getContext('2d');
        
        // Mirror image if using front camera
        if (currentFacingMode === 'user') {
            ctx.translate(cameraCanvas.width, 0);
            ctx.scale(-1, 1);
        }
        
        ctx.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
        
        base64Image = cameraCanvas.toDataURL('image/jpeg', 0.8);
        imagePreview.src = base64Image;
        imagePreview.style.display = 'block';
        
        stopCamera();
        cameraContainer.style.display = 'none';
    });

    regImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                base64Image = event.target.result;
                imagePreview.src = base64Image;
                imagePreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            imagePreview.style.display = 'none';
            base64Image = '';
        }
    });

    btnCancelReg.addEventListener('click', () => {
        stopCamera();
        if (cameraContainer) cameraContainer.style.display = 'none';
        regForm.reset();
        imagePreview.style.display = 'none';
        base64Image = '';
        showPage(loginPage);
        loginIdInput.value = '';
    });

    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const personId = regIdInput.value.trim();
        const name = document.getElementById('reg-name').value.trim();
        const surname = document.getElementById('reg-surname').value.trim();
        const address = document.getElementById('reg-address').value.trim();
        const phone = document.getElementById('reg-phone').value.trim();

        if (!base64Image) {
            Swal.fire('ข้อผิดพลาด', 'กรุณาอัปโหลดหรือถ่ายภาพ', 'error');
            return;
        }

        const formData = {
            personId,
            name,
            surname,
            address,
            phone,
            imageFile: base64Image,
            imageName: fileExtensionAndName(regImageInput.files[0] || { name: 'photo.jpg' })
        };

        Swal.fire({
            title: 'กำลังบันทึกข้อมูล...',
            text: 'และอัปโหลดรูปภาพไปยังบัญชีของคุณ กรุณารอสักครู่',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });

        try {
            const result = await callGAS('registerMember', formData, true);
            if (result.success) {
                Swal.fire('สำเร็จ', 'บันทึกข้อมูลเรียบร้อยแล้ว', 'success').then(() => {
                    regForm.reset();
                    imagePreview.style.display = 'none';
                    base64Image = '';
                    loadMembers();
                    showPage(membersPage);
                });
            } else {
                Swal.fire('เกิดข้อผิดพลาดจากเซิร์ฟเวอร์', result.error, 'error');
            }
        } catch (error) {
            Swal.fire('เกิดข้อผิดพลาดในการเชื่อมต่อ', error.message || String(error), 'error');
        }
    });

    function fileExtensionAndName(file) {
        if (!file) return 'image.jpg';
        return file.name || 'image.jpg';
    }

    // MEMBERS PAGE LOGIC
    btnLogout.addEventListener('click', () => {
        showPage(loginPage);
        loginIdInput.value = '';
    });

    async function loadMembers() {
        loadingMembers.style.display = 'block';
        membersList.innerHTML = '';
        
        try {
            const result = await callGAS('getAllMembers', {}, false);
            loadingMembers.style.display = 'none';
            if (result.success) {
                renderMembers(result.members);
            } else {
                membersList.innerHTML = `<p style="color:red">ไม่สามารถโหลดข้อมูลได้: ${result.error}</p>`;
            }
        } catch (error) {
            loadingMembers.style.display = 'none';
            membersList.innerHTML = `<p style="color:red">เกิดข้อผิดพลาดในการเชื่อมต่อ: ${error.message || String(error)}</p>`;
        }
    }

    function renderMembers(members) {
        membersList.innerHTML = '';
        
        if (!members || members.length === 0) {
            membersList.innerHTML = '<p style="text-align:center; color:#888;">ยังไม่มีสมาชิก</p>';
            return;
        }

        members.forEach(member => {
            const defaultImage = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name + ' ' + member.surname) + '&background=f1f5f9&color=3b82f6&size=128';
            const imgSrc = member.image ? member.image : defaultImage;
            
            const card = document.createElement('div');
            card.className = 'member-card';
            card.innerHTML = `
                <img src="${imgSrc}" class="member-photo" alt="Photo" onerror="this.src='${defaultImage}'">
                <div class="member-info">
                    <h3>${escapeHtml(member.name)} ${escapeHtml(member.surname)}</h3>
                </div>
            `;
            membersList.appendChild(card);
        });
    }

    function escapeHtml(unsafe) {
        return (unsafe || '').toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});

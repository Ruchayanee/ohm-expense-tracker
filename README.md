# โอม

เว็บแอปติดตามค่าใช้จ่ายสำหรับโอมและหม่าม๊า

- ฝั่งโอม: บันทึกรายจ่าย
- ฝั่งหม่าม๊า: ดูยอดค้างและบันทึกการโอน
- หน้าเว็บอยู่ใน `docs/` สำหรับ GitHub Pages
- ข้อมูลซิงก์กับ Google Sheet ผ่าน Apps Script

## ลิงก์หน้าเว็บหลังเปิด GitHub Pages

- หน้าเลือกฝั่ง: `https://USERNAME.github.io/REPO_NAME/`
- ฝั่งโอม: `https://USERNAME.github.io/REPO_NAME/child.html`
- ฝั่งหม่าม๊า: `https://USERNAME.github.io/REPO_NAME/mother.html`

## ไฟล์สำคัญ

- `docs/index.html` หน้าเลือกฝั่ง
- `docs/child.html` ฝั่งโอม
- `docs/mother.html` ฝั่งหม่าม๊า
- `docs/config.js` จุดใส่ลิงก์ Apps Script
- `apps-script/Code.gs` โค้ดสำหรับวางใน Google Apps Script
- `GITHUB_PAGES_SETUP.md` คู่มือเปิดใช้งานทีละขั้น

## วิธีเปิดใช้งาน

1. สร้าง Google Sheet
2. เปิด `Extensions > Apps Script`
3. วางโค้ดจาก `apps-script/Code.gs`
4. Deploy เป็น Web app
5. เอา `Web app URL` มาใส่ใน `docs/config.js`
6. เปิด GitHub Pages โดยเลือก source เป็น branch หลักและ folder `/docs`

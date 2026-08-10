# วิธีเอาแอป "โอม" ขึ้น GitHub Pages

## สิ่งที่ได้

- หน้าเลือกฝั่ง: `docs/index.html`
- ฝั่งโอม: `docs/child.html`
- ฝั่งหม่าม๊า: `docs/mother.html`
- โค้ดหลังบ้านสำหรับ Google Sheet: `apps-script/Code.gs`

## ขั้นที่ 1: ทำ Google Sheet

1. เปิด Google Drive
2. กด `New > Google Sheets`
3. ตั้งชื่อไฟล์ เช่น `โอม ค่าใช้จ่าย`
4. กด `Extensions > Apps Script`
5. ลบโค้ดเดิมออก
6. วางโค้ดจาก `apps-script/Code.gs`
7. กด `Save`

## ขั้นที่ 2: Deploy Apps Script

1. กด `Deploy > New deployment`
2. กดรูปเฟือง แล้วเลือก `Web app`
3. ตั้งค่า `Execute as` เป็น `Me`
4. ตั้งค่า `Who has access` เป็น `Anyone`
5. กด `Deploy`
6. อนุญาตสิทธิ์ด้วยบัญชี Google ของคุณ
7. คัดลอก `Web app URL`

## ขั้นที่ 3: เปิด GitHub Pages

1. เอาโปรเจกต์นี้ขึ้น GitHub
2. เข้า repo ใน GitHub
3. ไปที่ `Settings > Pages`
4. ตรง `Build and deployment` เลือก `Deploy from a branch`
5. เลือก branch หลัก เช่น `main`
6. เลือก folder เป็น `/docs`
7. กด `Save`

ถ้าไม่อยากให้แต่ละเครื่องต้องวางลิงก์เอง ให้เอา `Web app URL` ไปใส่ในไฟล์ `docs/config.js` ตรงนี้:

```js
window.OHM_APPS_SCRIPT_URL = "วางลิงก์ตรงนี้";
```

## ขั้นที่ 4: ใช้งาน

1. เปิดลิงก์ GitHub Pages ที่ GitHub ให้มา
2. เปิด `child.html` สำหรับฝั่งโอม
3. เปิด `mother.html` สำหรับฝั่งหม่าม๊า
4. วาง `Web app URL` ในช่อง `ลิงก์ Apps Script`
5. กด `บันทึกลิงก์`
6. กด `ดึงข้อมูล` หรือ `ส่งข้อมูล` ได้เลย

## หมายเหตุ

- หลังจากใส่ลิงก์ Apps Script แล้ว เวลาบันทึกรายจ่ายหรือการโอน แอปจะส่งข้อมูลขึ้น Google Sheet ให้อัตโนมัติ
- ถ้าเปิดจากมือถือหรือเครื่องอื่น ให้กด `ดึงข้อมูล` ก่อนใช้งาน เพื่อเอาข้อมูลล่าสุดจาก Google Sheet
- ระบบนี้เน้นใช้ง่าย ถ้ามีคนเปิดพร้อมกันและแก้ข้อมูลชนกัน ให้ยึดข้อมูลล่าสุดที่กดส่งขึ้น Sheet

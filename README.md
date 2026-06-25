# THE GOOD MILLION VIP

เว็บลงทะเบียน VIP และหลังบ้านสำหรับ THE GOOD MILLION CO., LTD.

ระบบนี้ใช้:

- GitHub Pages สำหรับ host หน้าเว็บ
- Supabase สำหรับเก็บข้อมูล

## เปิดใช้งานในเครื่อง

เปิด `index.html` ได้โดยตรง หรือใช้ Live Server ใน VS Code

บัญชีหลังบ้านเริ่มต้น:

```text
user: admin
password: admin123
```

ถ้ายังไม่ใส่ค่า Supabase ใน `config.js` ระบบจะใช้ `localStorage` เพื่อทดสอบในเครื่องก่อน

## ตั้งค่า Supabase

1. สร้างโปรเจกต์ใน Supabase
2. ไปที่ SQL Editor
3. วาง SQL จาก `supabase/schema.sql`
4. กด Run
5. ไปที่ Project Settings > API
6. คัดลอก `Project URL` และ `anon public key`
7. ใส่ค่าใน `config.js`

```js
window.TGM_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT_ID.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY"
};
```

ใช้เฉพาะ `anon public key` เท่านั้น ห้ามใส่ `service_role key` ในเว็บ

## ขึ้น GitHub

```powershell
git add .
git commit -m "Build The Good Million VIP portal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## เปิด GitHub Pages

1. เข้า repo ใน GitHub
2. Settings > Pages
3. Source: Deploy from a branch
4. Branch: `main`
5. Folder: `/root`
6. Save

## หมายเหตุความปลอดภัย

เวอร์ชันนี้เป็น MVP สำหรับเริ่มใช้งานและทดสอบ flow จริง โดย login หลังบ้านยังตรวจจากข้อมูลในตาราง `admin_users` ผ่าน browser โดยตรง ถ้าจะใช้กับข้อมูลจริงระยะยาว ควรย้ายระบบ login ไปใช้ Supabase Auth หรือ Edge Function เพื่อไม่ให้ password อยู่ฝั่ง client

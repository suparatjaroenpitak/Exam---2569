# ระบบฝึกทำข้อสอบออนไลน์

โปรเจกต์นี้เป็นเว็บแอปสำหรับฝึกทำข้อสอบ ก.พ. ออนไลน์ พัฒนาด้วย Next.js App Router, TypeScript และ Tailwind CSS โดยรองรับผู้ใช้ทั่วไปและผู้ดูแลระบบ มีระบบยืนยันตัวตนด้วย JWT, เก็บข้อมูลด้วยไฟล์ Excel ในโฟลเดอร์ `data/`, นำเข้าข้อสอบจาก PDF, ตรวจสอบข้อสอบด้วย AI, จัดหมวดหมู่อัตโนมัติ และสร้างข้อสอบใหม่ผ่าน OpenAI-compatible LLM endpoint

## ความสามารถหลัก

- สมัครสมาชิก, เข้าสู่ระบบ และออกจากระบบ
- แยกสิทธิ์ `user` และ `admin`
- สลับภาษาได้ 2 ภาษา: ไทย และ English
- สลับธีมได้ 2 โหมด: สว่าง และ มืด
- สุ่มข้อสอบตามวิชา หัวข้อย่อย จำนวนข้อ และระดับความยาก
- ระบบจับเวลาในการสอบและตรวจคะแนนอัตโนมัติ
- ดูประวัติการสอบย้อนหลังและสถิติผลลัพธ์แยกตามวิชาและหัวข้อย่อย
- ผู้ดูแลสามารถนำเข้าข้อสอบจาก PDF
- ผู้ดูแลสามารถสร้างข้อสอบใหม่ด้วย AI ตามวิชา/หัวข้อย่อย/ระดับความยาก
- AI classifier สำหรับจัดประเภทข้อสอบเป็นวิชาและหัวข้อย่อย
- AI validation pipeline สำหรับตรวจว่าข้อสอบจาก PDF เป็นข้อสอบแบบปรนัยที่ถูกต้องหรือไม่
- จัดเก็บคำถาม ผู้ใช้ และประวัติการสอบในไฟล์ Excel

## โครงสร้างวิชา ก.พ.

ระบบรองรับ 4 วิชาหลักตามโครงสร้างที่กำหนด

### 1. Analytical Thinking

- จำนวนมาตรฐาน: 50 ข้อ
- เวลาอ้างอิง: 60 นาที
- หัวข้อย่อย:
- Percentage
- Ratio
- Proportion
- Equation
- Speed Distance Time
- Number Comparison
- Data Tables
- Arithmetic Sequence
- Power Sequence
- Fraction Sequence
- Mixed Sequence
- Multi-sequence
- Symbolic Conditions
- Language Conditions
- Relationship Finding
- Logical Reasoning
- Odd-one-out
- Truth Tables
- Tables
- Graphs
- Charts
- Data Interpretation

### 2. Thai Language

- จำนวนมาตรฐาน: 25 ข้อ
- หัวข้อย่อย:
- Reading Comprehension
- Analyze Article
- Summarize
- Interpretation
- Correct Word
- Incorrect Word
- Thai Royal Vocabulary
- Sentence Structure
- Conjunction Usage
- Complete Sentence
- Synonym
- Antonym
- Word Groups

### 3. English Language

- จำนวนมาตรฐาน: 25 ข้อ
- หัวข้อย่อย:
- Tense
- Preposition
- Conjunction
- Article
- Vocabulary Synonym
- Vocabulary Antonym
- Fill in the Blank
- Passage Reading
- Story Questions

### 4. Government Law & Ethics

- จำนวนมาตรฐาน: 25 ข้อ
- หัวข้อย่อย:
- Civil Service Regulations
- Government Ethics
- Government Discipline
- Public Administration
- Good Governance Principles

## เทคโนโลยีที่ใช้

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Route Handlers ของ Next.js สำหรับ API
- `xlsx` สำหรับจัดเก็บข้อมูลแบบ Excel
- `pdf-parse` สำหรับอ่านไฟล์ PDF
- `jose` และ `bcryptjs` สำหรับ auth และ password hashing
- `zod` สำหรับ validate payload ของ API

## โครงสร้างโปรเจกต์

```text
src/
  app/                  หน้าเว็บหลักและ layout
  components/           UI components แยกตาม feature
  hooks/                React hooks
  i18n/                 ข้อความหลายภาษาและ helper
  lib/                  constants, types, guards, auth utilities
  services/             business logic และ Excel storage
  utils/                helper functions ทั่วไป
data/                   ไฟล์ Excel สำหรับ questions, users, history
```

## การตั้งค่า Environment

คัดลอกไฟล์ `.env.example` เป็น `.env.local`

```powershell
Copy-Item .env.example .env.local
```

ค่าที่ต้องตั้งมีดังนี้

```env
DATA_DIR=data
JWT_SECRET=replace-with-a-long-random-secret
OPEN_SOURCE_LLM_API_KEY=
OPEN_SOURCE_LLM_BASE_URL=https://openrouter.ai/api/v1
OPEN_SOURCE_LLM_MODEL=meta-llama/llama-3.1-8b-instruct:free
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=Admin12345!
```

## การตั้งค่า OPEN_SOURCE_LLM_API_KEY (LLM API key)

แอปจะเรียก LLM ผ่าน `OPEN_SOURCE_LLM_API_KEY` — ถ้าไม่ได้ตั้งค่าไว้ ฟีเจอร์ที่พึ่ง LLM (เช่นการสร้างข้อสอบด้วย AI หรือการตรวจข้อสอบจาก PDF) จะโยน Error: "Missing OPEN_SOURCE_LLM_API_KEY configuration".

ขั้นตอนการตั้งค่าสำหรับการพัฒนา (local):

1. คัดลอกไฟล์ตัวอย่างเป็นไฟล์ local:

```powershell
Copy-Item .env.example .env.local
```

2. เปิด `.env.local` แล้วใส่ค่า API key ของผู้ให้บริการ LLM เช่น OpenRouter:

```text
OPEN_SOURCE_LLM_API_KEY=sk_your_api_key_here
```

3. รันแอปในโหมดพัฒนาและทดสอบฟังก์ชัน admin (ล็อกอินเป็น admin ตาม `DEFAULT_ADMIN_EMAIL`/`DEFAULT_ADMIN_PASSWORD`) เพื่อเรียก endpoint `generate-questions` หรือ `import-pdf` จาก UI

การตั้งค่าสำหรับ Render (production):

- ไปที่หน้า Service → Environment → Add Environment Variable
- Key: `OPEN_SOURCE_LLM_API_KEY`
- Value: วาง API key ที่ได้จากผู้ให้บริการ

หมายเหตุเพิ่มเติม:

- ใน `render.yaml` ค่า `OPEN_SOURCE_LLM_API_KEY` ถูกตั้งเป็น `sync: false` — ระหว่างการสร้าง Blueprint ระบบจะ prompt ให้คุณใส่ค่าไว้ใน dashboard
- หากยังไม่ต้องการใช้ฟีเจอร์ AI สามารถเว้นค่านี้ว่างได้ แต่การเรียก API ที่พึ่ง LLM จะล้มเหลวจนกว่าจะตั้งค่า
- ถาต้องการ ผมช่วยเปลี่ยนพฤติกรรมโค้ดให้คืน HTTP 400 หรือปิดฟีเจอร์ AI แทนการ throw exception — บอกผมได้เลย

วิธีตรวจสอบค่าใน runtime (logs):

- ถ้าเรียกฟีเจอร์ AI แล้วได้ error ให้ดู logs ของ server จะเห็นข้อความ `Missing OPEN_SOURCE_LLM_API_KEY configuration` หรือข้อความจากการเรียก API ที่ล้มเหลว


คำอธิบายตัวแปรสำคัญ

- `DATA_DIR`: path สำหรับเก็บไฟล์ Excel ถ้าไม่กำหนดจะใช้ `data/` ใน root ของโปรเจกต์
- `JWT_SECRET`: ใช้สำหรับ sign token ควรตั้งเป็นค่ายาวและคาดเดายาก
- `OPEN_SOURCE_LLM_API_KEY`: API key สำหรับบริการ LLM ที่รองรับ OpenAI-compatible API
- `OPEN_SOURCE_LLM_BASE_URL`: base URL ของผู้ให้บริการ LLM
- `OPEN_SOURCE_LLM_MODEL`: ชื่อโมเดลที่ต้องการใช้สร้างข้อสอบ
- `DEFAULT_ADMIN_EMAIL`: อีเมลของ admin แรกที่ระบบจะ bootstrap ให้
- `DEFAULT_ADMIN_PASSWORD`: รหัสผ่านของ admin แรก

## การติดตั้งและรันโปรเจกต์

ติดตั้ง dependencies

```bash
npm install
```

รันโหมดพัฒนา

```bash
npm run dev
```

build production

```bash
npm run build
```

เริ่ม production server หลัง build

```bash
npm run start
```

ตรวจ lint

```bash
npm run lint
```

## บัญชีผู้ดูแลระบบเริ่มต้น

ถ้ายังไม่ได้เปลี่ยนค่าใน `.env.local` ระบบจะใช้ค่าตาม `.env.example`

- Email: `admin@example.com`
- Password: `Admin12345!`


ส่วนอันนี้ ผม ทดสอบ เว็บ ทำข้อสอบ กพ ภาค ก ได้ที่ 

https://exam-2569.onrender.com/

ผมลอง ใช้ host free จาก เว็บ  onrender 

หมายเหตุ: บัญชี admin แรกถูก bootstrap จาก environment variables ไม่ได้ hardcode ไว้ในหน้า UI

## การสลับภาษาและธีม

ในหน้า Landing Page, Login/Register และหน้าภายในระบบ จะมีตัวควบคุมสำหรับ:

- สลับภาษา `TH` และ `EN`
- สลับธีม `สว่าง` และ `มืด`

ค่าที่เลือกจะถูกเก็บใน `localStorage` ของเบราว์เซอร์ และถูกนำกลับมาใช้อัตโนมัติเมื่อเปิดเว็บใหม่

## การจัดเก็บข้อมูล

ระบบเก็บข้อมูลในไฟล์ Excel ภายใต้โฟลเดอร์ `data/`

ถ้าจะ deploy ไปยังโฮสต์ที่ mount storage คนละ path สามารถตั้ง `DATA_DIR` ให้ชี้ไปยังโฟลเดอร์นั้นได้ เช่น `/opt/render/project/src/data`

- ข้อสอบ
- ผู้ใช้
- ประวัติการทำข้อสอบ

โครงสร้างหลักของ `questions.xlsx`

- id
- subject
- category
- subcategory
- question
- choice_a
- choice_b
- choice_c
- choice_d
- correct_answer
- explanation
- difficulty
- source
- createdAt

ถ้าไฟล์ยังไม่มี ระบบจะสร้างให้ตอนที่มีการเขียนข้อมูลครั้งแรก

## ฟีเจอร์สำหรับผู้ใช้

### 1. สมัครและเข้าสู่ระบบ

ผู้ใช้ทั่วไปสามารถสมัครสมาชิกและเข้าสู่ระบบเพื่อเข้าหน้า dashboard และทำข้อสอบได้

### 2. Dashboard

หน้า dashboard แสดงข้อมูลหลัก เช่น

- จำนวนครั้งที่ทำข้อสอบ
- คะแนนสูงสุด
- คะแนนเฉลี่ย
- ฟอร์มสร้างชุดข้อสอบแบบจับเวลา
- ตารางประวัติการสอบ

### 3. การทำข้อสอบ

ผู้ใช้สามารถตั้งค่าได้ว่า:

- จะทำข้อสอบวิชาใด
- จะเลือกหัวข้อย่อยเฉพาะหรือทำแบบรวมทั้งวิชา
- ต้องการกี่ข้อ
- ต้องการโฟกัสระดับความยากแบบใด

เมื่อเริ่มสอบ ระบบจะ:

- สุ่มข้อสอบตามเงื่อนไข
- เริ่มจับเวลา
- ให้ผู้ใช้เปลี่ยนข้อไปมาได้
- ส่งคำตอบเพื่อตรวจคะแนน
- แสดงเฉลยและคำอธิบายหลังส่งข้อสอบ
- แสดงผลการทำข้อสอบแยกตามวิชาและหัวข้อย่อย

## ฟีเจอร์สำหรับผู้ดูแลระบบ

## Deploy บน Render

โปรเจกต์นี้ build ผ่านบน Next.js production mode และสามารถ deploy เป็น Node web service บน Render ได้

ข้อจำกัดสำคัญ:

- Render แผนฟรีรันแอปได้ แต่ filesystem เป็นแบบ ephemeral
- แอปนี้มีการเขียนไฟล์ Excel ลง `data/` ระหว่างใช้งานจริง เช่น ผู้ใช้, ประวัติสอบ, และข้อสอบที่ import
- ดังนั้นถ้าใช้ Render ฟรี ข้อมูลอาจหายเมื่อ service restart หรือ redeploy
- ถ้าต้องการเก็บข้อมูลถาวรจริง ควรใช้ persistent disk ของ Render ซึ่งเป็นฟีเจอร์แบบเสียเงิน หรือย้าย storage ออกไปยัง database/object storage

ไฟล์ `render.yaml` ถูกเพิ่มไว้แล้วสำหรับการสร้างบริการแบบ Blueprint

ค่าที่ควรใส่ตอน deploy:

- `DATA_DIR=data`
- `JWT_SECRET` ให้ Render generate หรือใส่ค่าเองที่ยาวและสุ่ม
- `DEFAULT_ADMIN_EMAIL` ตั้งเป็นอีเมลของผู้ดูแลระบบ
- `DEFAULT_ADMIN_PASSWORD` ตั้งเป็นรหัสผ่านเริ่มต้นของผู้ดูแลระบบ
- `OPEN_SOURCE_LLM_API_KEY` ใส่เมื่อจะใช้ฟีเจอร์ AI

คำสั่งที่ใช้บน Render:

- Build: `npm install && npm run build`
- Start: `npm run start`

ถ้าภายหลังอัปเกรดเป็น plan ที่รองรับ persistent disk สามารถ mount disk ไปที่ `/opt/render/project/src/data` และใช้ `DATA_DIR=data` ต่อได้เลย

### สร้าง Service ใหม่บน Render (Create a new Service)

เมื่อคุณคลิก "New Service" → ให้เลือก "Web Services" (New Web Service)

ค่าที่แนะนำในการกรอกหน้า Configure ของ Render:

- **Runtime:** Node
- **Build command:**

```bash
npm install && npm run build
```

- **Start command:**

```bash
npm run start
```

- **Branch:** `main` (หรือสาขาที่ต้องการ)
- **Plan:** `free` (สำหรับทดสอบ) — หากต้องการเก็บไฟล์ Excel ถาวร ให้เปลี่ยนเป็น paid แล้ว attach persistent disk
- **Region:** เลือกตามที่ใกล้ผู้ใช้ (เช่น `singapore`)

Environment variables ที่ควรตั้งในหน้า Environment / Secrets ของ Render:

- `DATA_DIR = data`
- `DEFAULT_ADMIN_EMAIL = asdrtsuparat2019@gmail.com`
- `DEFAULT_ADMIN_PASSWORD = ExamGP2569!Admin` (หรือรหัสที่คุณต้องการ)
- `JWT_SECRET` = ให้ Render generate หรือใส่ string ยาวสุ่ม
- `OPEN_SOURCE_LLM_API_KEY` = (ใส่เมื่อพร้อมใช้ฟีเจอร์ AI)
- `OPEN_SOURCE_LLM_BASE_URL = https://openrouter.ai/api/v1`
- `OPEN_SOURCE_LLM_MODEL = meta-llama/llama-3.1-8b-instruct:free`

ข้อควรระวังเพิ่มเติม:

- แผนฟรีของ Render ให้ไฟล์ระบบเป็น ephemeral — ข้อมูลที่เขียนลง `data/` อาจหายเมื่อ service restart หรือ redeploy
- หากต้องการข้อมูลคงทน ให้ใช้ persistent disk (ต้องเป็นแผนที่จ่ายเงิน) หรือตั้งค่าให้เก็บข้อมูลภายนอกเช่น PostgreSQL / S3

ถ้าคุณล็อกอินและเชื่อม GitHub เรียบร้อย ผมช่วยแนะนำทีละหน้าจอจนเว็บขึ้นใช้งานได้ — แจ้งผมเมื่อพร้อมครับ

### 1. ภาพรวมคลังข้อสอบ

หน้า admin แสดง:

- จำนวนข้อสอบทั้งหมด
- จำนวนข้อสอบแยกตามหมวดวิชา
- จำนวนข้อสอบตามระดับความยาก

### 2. นำเข้าข้อสอบจาก PDF

pipeline ปัจจุบัน

- อัปโหลด PDF
- ดึงข้อความด้วย `pdf-parse`
- แยกข้อความเป็น candidate question blocks
- ส่งแต่ละ block ให้ AI ตรวจสอบว่าเป็นข้อสอบจริงหรือไม่
- AI จัดวิชาและหัวข้อย่อยอัตโนมัติ
- บันทึกเฉพาะข้อที่ผ่าน validation ลง Excel

ตัวอย่างเรียก API:

```ts
const formData = new FormData();
formData.append("file", file);
formData.append("difficulty", "medium");

await fetch("/api/admin/import-pdf", {
  method: "POST",
  body: formData
});
```

### 3. สร้างข้อสอบด้วย AI

ผู้ดูแลสามารถเลือกได้

- subject
- subcategory
- difficulty
- number of questions

ตัวอย่างเรียก API:

```ts
await fetch("/api/admin/generate-questions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    category: "Analytical Thinking",
    subcategory: "Arithmetic Sequence",
    count: 20,
    difficulty: "hard"
  })
});
```

## AI Utilities

ระบบมี AI utility สำคัญดังนี้

- `classifyQuestion()` สำหรับจัดประเภทข้อสอบเป็นวิชาและหัวข้อย่อย
- `validateImportedQuestion()` สำหรับตรวจสอบข้อสอบจาก PDF ว่าผ่านเงื่อนไขหรือไม่
- `generateQuestionsWithAI()` สำหรับสร้างข้อสอบแบบหลายตัวเลือกตามเงื่อนไขที่ผู้ดูแลเลือก

ตัวอย่าง `classifyQuestion()`

```ts
const result = await classifyQuestion("ข้อใดเป็นลำดับเลขคณิตที่ถูกต้อง...");
// { subject: "Analytical Thinking", subcategory: "Arithmetic Sequence" }
```

ตัวอย่าง exam randomizer

```ts
const session = await createExamSession({
  category: "Analytical Thinking",
  subcategory: "all",
  count: 50,
  difficulty: "medium"
});
```

ตัวอย่าง timer system

```ts
const durationSeconds = getExamDurationSeconds("Analytical Thinking", 50);
```

ตัวอย่าง grading system

```ts
const summary = await gradeExamAttempt({
  userId,
  category: "Thai Language",
  subcategory: "all",
  questionIds,
  answers,
  durationSeconds
});
```

## เส้นทางหลักของระบบ

- `/` หน้าแรก
- `/login` หน้าเข้าสู่ระบบ
- `/register` หน้าสมัครสมาชิก
- `/dashboard` หน้า dashboard ของผู้ใช้
- `/exam` หน้าทำข้อสอบ
- `/admin` หน้าผู้ดูแลระบบ

## API สำคัญ

- `/api/auth/login`
- `/api/auth/logout`
- `/api/auth/register`
- `/api/auth/me`
- `/api/exam/create`
- `/api/exam/submit`
- `/api/history`
- `/api/admin/import-pdf`
- `/api/admin/generate-questions`

## การตรวจสอบก่อนส่งงาน

คำสั่งที่ใช้ตรวจสอบโปรเจกต์

```bash
npm run lint
npm run build
```

## หมายเหตุเพิ่มเติม

- ระบบนี้ออกแบบให้ทำงานภายใน workspace ปัจจุบัน
- เส้นทาง admin และ admin API ถูกป้องกันด้วย role checks
- ใช้ Excel เป็น storage หลักตามข้อกำหนดของโปรเจกต์
- ถ้าต้องการใช้งาน AI generation จริง ต้องตั้งค่า LLM endpoint และ API key ให้ถูกต้อง
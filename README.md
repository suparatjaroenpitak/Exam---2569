# ระบบฝึกทำข้อสอบออนไลน์

โปรเจกต์นี้เป็นเว็บแอปสำหรับฝึกทำข้อสอบ ก.พ. ออนไลน์ พัฒนาด้วย Next.js App Router, TypeScript และ Tailwind CSS โดยรองรับผู้ใช้ทั่วไปและผู้ดูแลระบบ มีระบบยืนยันตัวตนด้วย JWT, เก็บข้อมูลด้วยไฟล์ Excel ในโฟลเดอร์ `data/`, นำเข้าข้อสอบจาก PDF, จัดหมวดหมู่อัตโนมัติ, ป้องกันข้อสอบซ้ำ และสร้างข้อสอบใหม่ได้ทั้งแบบ rule-based และด้วยโมเดลภาษาไทยเชิงกำเนิด `typhoon-ai/llama3.1-typhoon2-8b-instruct`

## ความสามารถหลัก

- สมัครสมาชิก, เข้าสู่ระบบ และออกจากระบบ
- แยกสิทธิ์ `user` และ `admin`
- สลับภาษาได้ 2 ภาษา: ไทย และ English
- สลับธีมได้ 2 โหมด: สว่าง และ มืด
- สุ่มข้อสอบตามวิชา หัวข้อย่อย จำนวนข้อ และระดับความยาก โดยถ้าข้อสอบมีไม่ครบ ระบบจะใช้เท่าที่มีทั้งหมด
- ระบบจับเวลาในการสอบและตรวจคะแนนอัตโนมัติ
- ดูประวัติการสอบย้อนหลังและสถิติผลลัพธ์แยกตามวิชาและหัวข้อย่อย
- ผู้ดูแลสามารถนำเข้าข้อสอบจาก PDF ได้ทั้งแบบ parser ปกติและแบบใช้ OpenAI ช่วยแยกข้อสอบ
- ผู้ดูแลสามารถสร้างข้อสอบใหม่ด้วย AI ตามวิชา/หัวข้อย่อย/ระดับความยาก หรือใช้ตัวสร้างแบบไม่พึ่ง LLM
- ตรวจจับข้อสอบซ้ำก่อนบันทึกเข้าคลัง
- ผู้ดูแลสามารถดูรายการข้อสอบทั้งหมดพร้อมโจทย์ ตัวเลือก คำตอบ และคำอธิบายได้ในหน้า admin
- ผู้ดูแลสามารถปรับเวลาเริ่มต้นของข้อสอบ และปรับเวลาถอยหลังระหว่างสอบได้
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
- พ.ร.บ.ระเบียบบริหารราชการแผ่นดิน 2534
- พ.ร.ฎ.วิธีการบริหารกิจการบ้านเมืองที่ดี 2546
- พ.ร.บ.วิธีปฏิบัติราชการทางปกครอง 2539
- ป.อ.2499 (ในส่วนความผิดต่อตำแหน่งหน้าที่ราชการ)
- พ.ร.บ.ความรับผิดและการละเมิดของเจ้าหน้าที่
- พ.ร.บ.มาตราฐานทางจริยธรรม 2562

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
HUGGINGFACE_API_KEY=
THAI_GENERATOR_BASE_URL=https://api-inference.huggingface.co/models
THAI_GENERATOR_MODEL=typhoon-ai/llama3.1-typhoon2-8b-instruct
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=Admin12345!
```

## การเปลี่ยนแปลงการใช้งาน AI/NLP ในเวอร์ชันนี้

ระบบใช้ 2 ส่วนแยกกันชัดเจน:

- การสร้างข้อสอบจากหน้า admin ใช้โมเดลภาษาไทยเชิงกำเนิด `typhoon-ai/llama3.1-typhoon2-8b-instruct` ผ่าน Hugging Face Inference API
- การนำเข้า PDF และการจัดหมวด/ตรวจสอบข้อสอบยังใช้ตัวแยกและกฎ Thai NLP ภายในแอป
- ถ้าเรียกโมเดลไม่สำเร็จ ระบบจะ fallback ไปใช้ template generator เพื่อไม่ให้หน้า admin พัง

หมายเหตุ: ตัวโมเดลเป็น open-weight และใช้ฟรีในเชิงโมเดล แต่การเรียกผ่าน Hugging Face hosted inference โดยทั่วไปควรใช้ `HUGGINGFACE_API_KEY` ของบัญชี Hugging Face เพื่อให้เรียกใช้งานได้เสถียร

ขั้นตอนการตั้งค่าสำหรับการพัฒนา (local):

1. คัดลอกไฟล์ตัวอย่างเป็นไฟล์ local:

```powershell
Copy-Item .env.example .env.local
```

2. เปิด `.env.local` แล้วใส่ค่า API key ตาม provider ที่ต้องการใช้งาน:

ตัวอย่าง OpenRouter

```text
https://openrouter.ai/
```

```text
OPEN_SOURCE_LLM_API_KEY=sk_your_api_key_here
```

ตัวอย่าง OpenAI

```text
OPENAI_API_KEY=sk_your_openai_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

3. รันแอปในโหมดพัฒนาและทดสอบฟังก์ชัน admin (ล็อกอินเป็น admin ตาม `DEFAULT_ADMIN_EMAIL`/`DEFAULT_ADMIN_PASSWORD`) เพื่อเรียก endpoint `generate-questions` หรือ `import-pdf` จาก UI

การตั้งค่าสำหรับ Render (production):

- ไปที่หน้า Service → Environment → Add Environment Variable
- ใส่ค่า `OPEN_SOURCE_LLM_API_KEY` เมื่อต้องการใช้ LLM generator
- ใส่ค่า `OPENAI_API_KEY` เมื่อต้องการใช้ OpenAI ช่วย import PDF

หมายเหตุเพิ่มเติม:

- ใน `render.yaml` สามารถตั้ง secret เหล่านี้ผ่าน dashboard ได้
- หากยังไม่ต้องการใช้ฟีเจอร์ AI บางส่วน สามารถเว้นค่า key นั้นว่างได้ ระบบจะ fallback ตามที่รองรับ

การตั้งค่าเพิ่มเติมและตัวอย่างคำสั่งสำหรับ Render (production)

- ตัวแปรที่แอปอ่านโดยตรงในเวอร์ชันปัจจุบันคือ `OPEN_SOURCE_LLM_API_KEY`, `OPEN_SOURCE_LLM_BASE_URL`, `OPEN_SOURCE_LLM_MODEL`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`

- ตัวอย่างการสร้าง/อัปเดต secret ผ่าน Render CLI (ต้องติดตั้ง `render` CLI และล็อกอินก่อน):

```bash
render login
# สร้าง secret ครั้งแรก
render secrets create --service <SERVICE_ID> OPEN_SOURCE_LLM_API_KEY "sk_or_other_provider_your_key_here"
render secrets create --service <SERVICE_ID> OPENAI_API_KEY "sk_openai_key_here"

# อัพเดตค่าที่มีอยู่แล้ว
render secrets update --service <SERVICE_ID> OPEN_SOURCE_LLM_API_KEY "<your-new-key>"
render secrets update --service <SERVICE_ID> OPENAI_API_KEY "<your-new-key>"
```

- ถ้าตั้งค่าผ่าน Dashboard:
  1. ไปที่ Render → เลือก Service → Environment
 2. Add Environment Variable / Secret → ใส่ `OPEN_SOURCE_LLM_API_KEY` และ/หรือ `OPENAI_API_KEY` → วางค่า → Save

- หลังตั้ง secret แล้วให้สั่ง redeploy (ถ้า `autoDeployTrigger: commit` ไม่ได้เปิดไว้ หรือคุณต้องการ deploy ทันที):

  - Manual deploy (Dashboard): Service → Deploys → Manual Deploy → Deploy Latest Commit
  - หรือ commit `render.yaml` แล้ว `git push` ขึ้น remote เพื่อให้ Render ทำ auto-deploy:

```powershell
git add render.yaml
git commit -m "Update env vars for AI providers"
git push origin <your-branch>
```

- ตรวจสอบผลการ deploy:
  - ดู Deploy logs ใน Dashboard ว่า build & start สำเร็จ
  - ทดสอบ endpoint ที่ healthCheckPath (`/login`) หรือหน้าเว็บหลัก

- ข้อควรระวังความปลอดภัย:
  - ห้าม commit คีย์จริงลงใน repo — ถามพบคีย์หลุด ให้ rotate ทันที
  - ถ้าคีย์ถูก commit ไปแล้ว ให้ลบ commit ที่มีคีย์และเปลี่ยนคีย์ (rotate)

ถ้าต้องการผมช่วยรัน `git commit` + `git push` จาก repo นี้ และช่วยสังเกตผล deploy บน Render บอกผมได้ (ผมจะแจ้งขั้นตอนและรออนุญาตก่อนจะรันคำสั่งจริง)

วิธีตรวจสอบค่าใน runtime (logs):

- ถ้าเรียกฟีเจอร์ AI แล้วได้ error ให้ดู logs ของ server จะเห็นข้อความ เช่น `Missing OPEN_SOURCE_LLM_API_KEY configuration`, `Missing OPENAI_API_KEY configuration` หรือข้อความจากการเรียก API ที่ล้มเหลว


คำอธิบายตัวแปรสำคัญ

- `DATA_DIR`: path สำหรับเก็บไฟล์ Excel ถ้าไม่กำหนดจะใช้ `data/` ใน root ของโปรเจกต์
- `JWT_SECRET`: ใช้สำหรับ sign token ควรตั้งเป็นค่ายาวและคาดเดายาก
- `OPEN_SOURCE_LLM_API_KEY`: API key สำหรับบริการ LLM ที่รองรับ OpenAI-compatible API
- `OPEN_SOURCE_LLM_BASE_URL`: base URL ของผู้ให้บริการ LLM
- `OPEN_SOURCE_LLM_MODEL`: ชื่อโมเดลที่ต้องการใช้สร้างข้อสอบ
- `OPENAI_API_KEY`: API key สำหรับโหมดนำเข้า PDF ที่ใช้ OpenAI ช่วยแยกข้อสอบ
- `OPENAI_BASE_URL`: base URL ของ OpenAI-compatible endpoint สำหรับ PDF import
- `OPENAI_MODEL`: ชื่อโมเดล OpenAI ที่ใช้สำหรับ PDF import
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
- ต้องการกี่ข้อ หรือเลือกใช้ข้อสอบทั้งหมดที่มีในคลังของวิชานั้น
- ต้องการโฟกัสระดับความยากแบบใด

เมื่อเริ่มสอบ ระบบจะ:

- สุ่มข้อสอบตามเงื่อนไข และถ้ามีข้อสอบไม่ถึงจำนวนที่ร้องขอ จะใช้เท่าที่มี
- เริ่มจับเวลา
- ให้ผู้ใช้เปลี่ยนข้อไปมาได้
- ส่งคำตอบเพื่อตรวจคะแนน
- แสดงเฉลยและคำอธิบายหลังส่งข้อสอบ
- แสดงผลการทำข้อสอบแยกตามวิชาและหัวข้อย่อย

## ฟีเจอร์สำหรับผู้ดูแลระบบ

ผู้ดูแลระบบสามารถใช้งานได้ดังนี้

- ดูสรุปจำนวนข้อสอบทั้งหมด แยกตามวิชาและระดับความยาก
- ดูรายการข้อสอบทั้งหมดพร้อมโจทย์ ตัวเลือก คำตอบที่ถูก และคำอธิบาย
- ค้นหาและกรองข้อสอบในคลัง
- นำเข้าข้อสอบจาก PDF แบบ parser ปกติหรือแบบใช้ OpenAI
- สร้างข้อสอบใหม่แบบ AI หรือแบบ rule-based fallback
- ปรับเวลาเริ่มต้นก่อนสอบ และปรับเวลาถอยหลังระหว่างทำข้อสอบเมื่อเข้าสู่โหมดสอบด้วยสิทธิ์ admin

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
- `OPEN_SOURCE_LLM_API_KEY` ใส่เมื่อจะใช้ LLM generator
- `OPENAI_API_KEY` ใส่เมื่อจะใช้ OpenAI สำหรับ import PDF

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
- `OPENAI_API_KEY` = (ใส่เมื่อพร้อมใช้ OpenAI import PDF)
- `OPENAI_BASE_URL = https://api.openai.com/v1`
- `OPENAI_MODEL = gpt-4o-mini`

ข้อควรระวังเพิ่มเติม:

- แผนฟรีของ Render ให้ไฟล์ระบบเป็น ephemeral — ข้อมูลที่เขียนลง `data/` อาจหายเมื่อ service restart หรือ redeploy
- หากต้องการข้อมูลคงทน ให้ใช้ persistent disk (ต้องเป็นแผนที่จ่ายเงิน) หรือตั้งค่าให้เก็บข้อมูลภายนอกเช่น PostgreSQL / S3

ถ้าคุณล็อกอินและเชื่อม GitHub เรียบร้อย ผมช่วยแนะนำทีละหน้าจอจนเว็บขึ้นใช้งานได้ — แจ้งผมเมื่อพร้อมครับ

### 1. ภาพรวมคลังข้อสอบ

หน้า admin แสดง:

- จำนวนข้อสอบทั้งหมด
- จำนวนข้อสอบแยกตามหมวดวิชา
- จำนวนข้อสอบตามระดับความยาก
- รายการข้อสอบทั้งหมดพร้อมโจทย์ ตัวเลือก คำตอบที่ถูก และคำอธิบาย
- ช่องค้นหาและกรองหมวดวิชา

### 2. นำเข้าข้อสอบจาก PDF

pipeline ปัจจุบัน

- อัปโหลด PDF
- ดึงข้อความด้วย `pdf-parse`
- เลือกได้ว่าจะใช้ parser ปกติ หรือ OpenAI ช่วยแยกข้อสอบ
- ระบบจัดวิชาและหัวข้อย่อยอัตโนมัติ
- ระบบตรวจข้อสอบซ้ำก่อนบันทึกเข้าคลัง
- หลังนำเข้าสำเร็จ หน้า admin จะ refresh ข้อมูลให้อัตโนมัติ

ตัวอย่างเรียก API:

```ts
const formData = new FormData();
formData.append("file", file);
formData.append("parser", "openai");

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

ถ้าไม่มี `OPEN_SOURCE_LLM_API_KEY` ระบบจะ fallback ไปใช้ตัวสร้างแบบ rule-based ฟรี

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
- `generateQuestionsWithAI()` สำหรับสร้างข้อสอบแบบหลายตัวเลือกตามเงื่อนไขที่ผู้ดูแลเลือก
- `generateQuestionsWithoutLLM()` สำหรับสร้างข้อสอบแบบ rule-based โดยไม่ใช้ LLM
- `extractQuestionsFromPdfWithOpenAI()` สำหรับแยกข้อสอบจาก PDF โดยใช้ OpenAI

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

ตัวอย่างแบบใช้ข้อสอบทั้งหมดที่มี

```ts
const session = await createExamSession({
  category: "English Language",
  subcategory: "all",
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
- ถ้าต้องการใช้งาน AI generation จริง ต้องตั้งค่า provider key ให้ถูกต้องตามฟีเจอร์ที่ใช้
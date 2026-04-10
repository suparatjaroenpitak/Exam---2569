# ระบบฝึกทำข้อสอบออนไลน์

## Overview

ระบบนี้เป็นแอปฝึกทำข้อสอบ ก.พ. ที่ใช้ Next.js App Router สำหรับ frontend และ API, ใช้ Python AI Engine แยกต่างหากด้วย FastAPI, และใช้ Prisma ORM เป็นชั้นจัดเก็บข้อมูลหลักแทน Excel เดิม

เป้าหมายของเวอร์ชันนี้คือ

- ใช้ Python AI Engine เป็นแกนการสร้างข้อสอบ
- ใช้ PyThaiNLP และ rule-based generation เป็นหลัก
- ใช้ transformers เฉพาะกรณีจำเป็น
- ป้องกันข้อสอบไม่ตรงหัวข้อ, ซ้ำ, choice ซ้ำ, และเคส generate = 0
- ใช้ Prisma ORM กับ SQLite ใน development และ PostgreSQL ใน production

## Tech Stack

- Frontend / Backend API: Next.js 15, React 19, TypeScript, Tailwind CSS
- AI Engine: FastAPI, PyThaiNLP, scikit-learn
- ORM: Prisma ORM
- Database:
  - Development: SQLite
  - Production: PostgreSQL
- Auth: JWT + bcryptjs

## Architecture

- [src/app](src/app) เป็น App Router และ route handlers ของ Next.js
- [src/services](src/services) เป็น business logic และ orchestration ของ generation / exam / auth
- [ai_engine](ai_engine) เป็น Python AI Engine แบบ FastAPI และ CLI fallback
- [prisma](prisma) เป็น Prisma schema
- [logs](logs) เป็น JSON logs ของ generation/import

Validation pipeline:

1. generate
2. topic check
3. duplicate check
4. choice check
5. quality score
6. save

## AI Engine

ไฟล์หลักของ Python engine:

- [ai_engine/main.py](ai_engine/main.py)
- [ai_engine/generator.py](ai_engine/generator.py)
- [ai_engine/validator.py](ai_engine/validator.py)
- [ai_engine/duplicate.py](ai_engine/duplicate.py)
- [ai_engine/topic_classifier.py](ai_engine/topic_classifier.py)

สิ่งที่ใช้จาก PyThaiNLP:

- `word_tokenize`
- `sent_tokenize`
- `normalize`
- stopword corpus สำหรับ keyword extraction แบบ rule-based

หลักการ generate:

- ใช้ template และกฎที่กำหนดต่อหัวข้อก่อน
- ใช้ fallback template เสมอเมื่อ candidate ก่อนหน้าไม่ผ่าน validation
- ไม่คืนค่า `[]`
- topic กฎหมายมี keyword mapping ชัดเจนตามหัวข้อที่กำหนด

Duplicate detection:

- TF-IDF + cosine similarity
- ถ้า similarity > 0.85 จะ reject และ regenerate/top-up

Quality score:

- clarity
- topic relevance
- difficulty
- answer correctness

ต่ำกว่า 70 จะไม่ถูกบันทึกเป็นข้อสอบผ่านคุณภาพ

## Database Setup

Prisma schema อยู่ที่ [prisma/schema.prisma](prisma/schema.prisma)

Question model หลักประกอบด้วย

- `id`
- `subject`
- `topic`
- `question`
- `choiceA` ถึง `choiceD`
- `answer`
- `explanation`
- `difficulty`
- `hash`
- `createdAt`

มี field metadata เพิ่มเติมสำหรับ validation badge เช่น `topicVerified`, `noDuplicate`, `qualityPassed`, `qualityScore`

Environment variables ที่สำคัญ:

```env
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_PROVIDER=sqlite
DATABASE_URL="file:./prisma/dev.db"
PYTHON_AI_URL=http://127.0.0.1:8000
ALLOW_PYTHON_CLI_FALLBACK=1
ENABLE_TRANSFORMER_FALLBACK=0
TRANSFORMERS_MODEL=Qwen/Qwen2.5-1.5B-Instruct
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=change-me-in-env
```

สำหรับ production ให้เปลี่ยนเป็น PostgreSQL เช่น

```env
DATABASE_PROVIDER=postgresql
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public"
```

## How To Run

1. ติดตั้ง dependencies ของ Node.js

```powershell
npm install
```

2. ติดตั้ง dependencies ของ Python engine

```powershell
pip install -r ai_engine/requirements.txt
```

3. สร้าง Prisma client และ migrate database

```powershell
npx prisma generate
npx prisma migrate dev --name init-prisma-db
```

4. รัน Python AI Engine

```powershell
uvicorn ai_engine.main:app --reload --host 127.0.0.1 --port 8000
```

5. รัน Next.js app

```powershell
npm run dev
```

## API Usage

Admin generation endpoint:

`POST /api/generate`

Request body:

```json
{
  "subject": "Analytical Thinking",
  "topic": "Percentage",
  "difficulty": "easy",
  "count": 5
}
```

Response จะคืนอย่างน้อย 1 ข้อเสมอเมื่อ Python AI engine พร้อมใช้งาน และจะพยายามใช้ cache จากคลังข้อสอบก่อน top-up generation

Admin-only endpoints ยังคงถูกป้องกันด้วย role checks ทั้งหน้า `/admin` และ APIs ใต้ `/api/admin` รวมถึง `/api/generate`

## Frontend Notes

รายการข้อสอบในหน้า admin แสดง badge ต่อข้อ เช่น

- AI Generated
- Topic Verified
- No Duplicate
- Quality Passed

## Logging

ระบบจะเขียน generation logs ไปที่ [logs/generation.json](logs/generation.json) ในรูปแบบ JSON โดยเก็บอย่างน้อย

- generated
- saved
- rejected
- topic

Import log จะอยู่ใน [logs/import_log.json](logs/import_log.json)

## Tests

Python unit tests ครอบคลุมอย่างน้อย

- topic match
- duplicate detection
- generation != 0

รันด้วยคำสั่ง

```powershell
pytest ai_engine/tests -q
```

## Deployment

โปรเจกต์นี้มี Blueprint สำหรับ Render ใน [render.yaml](render.yaml) ซึ่ง deploy ให้ครบ 3 ส่วน:

1. Next.js app (`online-exam-practice-system`)
2. FastAPI AI engine (`exam-ai-engine`)
3. PostgreSQL database (`exam-app-db`)

การเชื่อมต่อระหว่าง services:

- Next app รับ `DATABASE_URL` จาก Render Postgres โดยตรง
- Blueprint จะตั้ง `PYTHON_AI_HOSTPORT` จาก service `exam-ai-engine` อัตโนมัติผ่าน Render private network
- ถ้าต้องการบังคับให้เรียกผ่าน public URL แทน internal network ให้ตั้ง `PYTHON_AI_URL` เป็นค่าเช่น `https://exam-ai-engine.onrender.com`
- ใน production ปิด Python CLI fallback ด้วย `ALLOW_PYTHON_CLI_FALLBACK=0` เพื่อไม่ให้ Next app พยายามรัน `ai_engine/main.py` ภายใน Node container

ข้อจำกัดสำคัญของ Render free plan:

- free web services ส่ง request ผ่าน private network ได้ แต่รับ private-network traffic ไม่ได้
- ดังนั้นถ้า AI engine ยังเป็น `type: web` และ `plan: free` ให้ใช้ public URL ของ AI service แทน `hostport`

ค่าที่ Render จะขอให้กรอกเองครั้งแรก:

- `PYTHON_AI_URL`
- `HUGGINGFACE_API_KEY`
- `DEFAULT_ADMIN_EMAIL`
- `DEFAULT_ADMIN_PASSWORD`

สิ่งที่ Blueprint ทำให้แล้ว:

- รัน `npx prisma generate` ตอน build ของ Next.js app
- รัน `npx prisma migrate deploy` ก่อน start app
- build AI engine จากโฟลเดอร์ `ai_engine` โดยตรง
- ติดตั้ง Python dependencies จาก `ai_engine/requirements.txt`
- ผูก app เข้ากับ database และ AI engine อัตโนมัติ

วิธี deploy:

1. Push repo นี้ขึ้น Git provider
2. ใน Render เลือกสร้าง Blueprint จาก repo
3. ยืนยันค่าของ env vars ที่เป็น `sync: false`
4. กด deploy

ถ้าต้องการลดภาระเครื่อง production ให้เปิด `ENABLE_TRANSFORMER_FALLBACK=0` และใช้ rule-based generation เป็น default

หมายเหตุ:

- Blueprint นี้ใช้ `plan: free` สำหรับ web services ตาม config ปัจจุบัน
- Render Postgres plan ไม่ถูก fix ไว้ในไฟล์นี้ เพื่อให้เลือกตาม workspace/สิทธิ์ที่มีอยู่ได้ตอนสร้าง resource


user admin ไว้สร้างข้อสอบ ครับ

- Email: `admin@example.com`
- Password: `Admin12345!`

ิเว็บ 

https://exam-2569.onrender.com/login

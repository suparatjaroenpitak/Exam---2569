# วิธีเชื่อมต่อ Ollama บน Google Colab เข้ากับแอพข้อสอบ

## ขั้นตอน

### 1. รัน Colab Notebook

เปิด `colab-ollama-setup.ipynb` ใน Google Colab:
- ไปที่ [colab.research.google.com](https://colab.research.google.com)
- File → Upload Notebook → เลือกไฟล์ `colab-ollama-setup.ipynb`
- รันทุก cell ตามลำดับ (Runtime → Run all)

### 2. คัดลอก Cloudflare Tunnel URL

หลังจากรัน notebook ครบ จะเห็นข้อความประมาณนี้:

```
============================================================
Ollama API is accessible at:
  https://xxxx-xxx-xxx-xxx.trycloudflare.com/api

Copy this URL and set it as OLLAMA_BASE_URL in your .env.local:
  OLLAMA_BASE_URL=https://xxxx-xxx-xxx-xxx.trycloudflare.com/api
  OLLAMA_MODEL=gemma2:2b
  ENABLE_OLLAMA=1
============================================================
```

คัดลอก URL `https://xxxx-xxx-xxx-xxx.trycloudflare.com/api` ไปใช้

### 3. ตั้งค่าใน `.env.local`

เปิดไฟล์ `.env.local` ที่ root ของโปรเจค แล้วเพิ่มหรือแก้ไข:

```env
OLLAMA_BASE_URL=https://xxxx-xxx-xxx-xxx.trycloudflare.com/api
OLLAMA_MODEL=gemma2:2b
ENABLE_OLLAMA=1
```

### 4. รันแอพ

```bash
npm run dev
```

### 5. ทดสอบ

เข้าไปที่ Admin Dashboard → จะเห็นป้ายสีเขียว "Ollama AI Connected"

**สร้างข้อสอบ**: ใช้ NLP Generator Form → Ollama จะถูกเรียกใช้เป็นอันดับแรก
**นำเข้าไฟล์**: ใช้ File Import Form → ถ้าเป็น PDF และเลือก "Use Ollama AI extraction" จะใช้ Ollama ช่วยดึงข้อสอบ

---

## การเปลี่ยนรุ่นโมเดล

ใน Colab notebook, เปลี่ยนตัวแปร `MODEL_NAME` ก่อนรัน cell pull model:

```python
MODEL_NAME = "qwen2.5:1.5b"  # หรือ llama3.2:3b, phi4:latest ฯลฯ
```

แล้วอัปเดต `OLLAMA_MODEL` ใน `.env.local` ให้ตรงกัน:

```env
OLLAMA_MODEL=qwen2.5:1.5b
```

---

## หมายเหตุ

- **ต้องเปิด Colab notebook ทิ้งไว้** ตลอดเวลาที่ใช้แอพ ถ้าปิดหรือ runtime  disconnect tunnel จะหาย
- Cloudflare Tunnel **ไม่ต้องสมัครบัญชี** ใช้งานฟรี
- ถ้า Colab runtime หลุด ให้รัน notebook ใหม่ แล้วอัปเดต URL ใน `.env.local`
- โมเดลแนะนำสำหรับภาษาไทย: `gemma2:2b`, `qwen2.5:1.5b`, `llama3.2:3b`

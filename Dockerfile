FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="/opt/venv/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv build-essential ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv "$VIRTUAL_ENV"

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma.config.ts ./prisma.config.ts
COPY prisma ./prisma
COPY requirements.txt ./requirements.txt
COPY ai_engine/requirements.txt ./ai_engine/requirements.txt

RUN pip install --upgrade pip setuptools wheel \
  && pip install -r requirements.txt \
  && npm ci

COPY . .

RUN npx prisma generate \
  && npm run build

ENV NODE_ENV=production
ENV PYTHON_EXEC=python3
ENV ALLOW_PYTHON_CLI_FALLBACK=1

EXPOSE 10000

CMD ["sh", "./scripts/render-start.sh"]
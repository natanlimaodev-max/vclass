# Build stage
FROM node:20-alpine AS builder

WORKDIR /app/projects/kitsune-avatar

# Install deps first (cache layer)
COPY projects/kitsune-avatar/package.json projects/kitsune-avatar/package-lock.json ./
RUN npm ci

# Copy source + shared assets
COPY projects/kitsune-avatar/ ./
COPY shared/ /app/shared/

# Build Next.js
RUN npm run build

# ────────────────────────────────────────────────
# Runtime stage
FROM node:20-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app/projects/kitsune-avatar

# Next.js built output
COPY --from=builder /app/projects/kitsune-avatar/.next ./.next
COPY --from=builder /app/projects/kitsune-avatar/public ./public
COPY --from=builder /app/projects/kitsune-avatar/package.json ./package.json

# node_modules needed at runtime (sql.js WASM + next itself)
COPY --from=builder /app/projects/kitsune-avatar/node_modules ./node_modules

# Shared prompts + scenario contexts (read by API routes at runtime)
COPY --from=builder /app/shared /app/shared

EXPOSE 3000

CMD ["node_modules/.bin/next", "start"]

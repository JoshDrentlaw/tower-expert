FROM denoland/deno:alpine
WORKDIR /app
COPY . .
RUN deno cache main.ts
EXPOSE 8787
CMD ["task", "start"]

FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        ca-certificates \
        curl \
        jq \
        python3 \
        gh \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g \
        ajv-cli \
        ajv-formats \
        @anthropic-ai/claude-code \
    && npm cache clean --force

# Codex CLI is optional; install on a best-effort basis. Don't fail the build
# if upstream is unreachable or the package is renamed.
RUN npm install -g @openai/codex || \
    echo "WARN: codex CLI install failed; container will work without it."

WORKDIR /work

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bash"]

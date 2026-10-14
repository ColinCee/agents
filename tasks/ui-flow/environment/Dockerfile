FROM ubuntu:24.04

RUN apt-get update && apt-get install -y curl git python3 python3-pip nodejs npm procps \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/python3 /usr/local/bin/python \
    && pip install --break-system-packages ruff==0.17.0 pytest==8.4.1 playwright==1.47.0 \
    && PLAYWRIGHT_BROWSERS_PATH=/opt/browsers playwright install --with-deps chromium \
    && chmod -R a+rX /opt/browsers

# The agent is installed once here, not on every trial: Harbor skips its own install when
# `claude` is already on the PATH. Pinned so every trial runs the same version.
RUN npm install -g @anthropic-ai/claude-code@2.1.296

COPY repo/ /app/
COPY build_fixture.sh /tmp/
RUN bash /tmp/build_fixture.sh && rm /tmp/build_fixture.sh

# The agent works as an ordinary user who owns the project and nothing else.
RUN useradd --create-home --uid 1001 agent && chown -R agent:agent /app \
    && git config --system --add safe.directory /app

# A browser the agent can drive, as on a developer's machine.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/browsers
WORKDIR /app

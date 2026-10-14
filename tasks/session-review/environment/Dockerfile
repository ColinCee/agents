FROM ubuntu:24.04

RUN apt-get update && apt-get install -y curl git python3 python3-pip nodejs npm procps \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/python3 /usr/local/bin/python

# The agent is installed once here, not on every trial: Harbor skips its own install when
# `claude` is already on the PATH. Pinned so every trial runs the same version.
RUN npm install -g @anthropic-ai/claude-code@2.1.296

# The owner's home: three projects, their instructions, and two weeks of invented agent sessions.
COPY make_sessions.py /tmp/
RUN useradd --create-home --uid 1001 agent \
    && python3 /tmp/make_sessions.py /home/agent \
    && chown -R agent:agent /home/agent \
    && rm /tmp/make_sessions.py

WORKDIR /home/agent

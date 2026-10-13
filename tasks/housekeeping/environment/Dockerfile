FROM ubuntu:24.04

RUN apt-get update && apt-get install -y curl git python3 python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/python3 /usr/local/bin/python \
    && pip install --break-system-packages ruff==0.17.0 pytest==8.4.1

COPY repo/ /app/
COPY build_fixture.sh /tmp/build_fixture.sh
RUN bash /tmp/build_fixture.sh && rm /tmp/build_fixture.sh

WORKDIR /app

#!/bin/bash
for p in $(pgrep -f "[l]ocalstack.runtime.main") $(pgrep -f "[m]oto_server"); do kill $p; done

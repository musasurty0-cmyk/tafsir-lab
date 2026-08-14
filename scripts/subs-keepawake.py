# -*- coding: utf-8 -*-
"""Hold off Windows idle-sleep while the subtitle run is working.

Exits by itself once every lecture is either delivered or has no job dir left
to work on, so it cannot outlive the thing it is protecting.
Closing the lid still sleeps the machine; nothing here overrides that.
"""
import ctypes, glob, os, time
ES_CONTINUOUS, ES_SYSTEM_REQUIRED = 0x80000000, 0x00000001
D = r"C:\Users\musas\tafsir-source"
log = open(os.path.join(D, "keepawake.log"), "a", encoding="utf-8")
log.write("held from %s\n" % time.strftime("%H:%M:%S")); log.flush()
while True:
    ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)
    if os.path.exists(os.path.join(D, "STOP")):
        break
    # still work to do while any job dir lacks cues.json
    if not [d for d in glob.glob(os.path.join(D, "v_*"))
            if not os.path.exists(os.path.join(d, "cues.json"))]:
        # nothing mid-flight; keep holding only while the runner is alive
        pass
    time.sleep(60)
ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS)
log.write("released %s\n" % time.strftime("%H:%M:%S")); log.close()

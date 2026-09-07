Miris Web SDK — local build
===========================
version : 0.0.9-budget-lab.bd3d02d
source  : Miris-Inc/aqua PR #5982 (markojagodic/budget-lab)
commit  : bd3d02d73560ed9273e8eca6e9ccb48518a90f15
built   : production env, WASM from the same commit (StreamClient.cpp recompiled)

Install (order matters — three and components peer-depend on core at this exact version):

  npm install ./miris-inc-core-0.0.9-budget-lab.bd3d02d.tgz \
              ./miris-inc-three-0.0.9-budget-lab.bd3d02d.tgz \
              ./miris-inc-components-0.0.9-budget-lab.bd3d02d.tgz

`three` is a peer dependency (>=0.182.0 <0.186.0) and is not bundled.
No sourcemaps and no shark/webshark WASM are included.

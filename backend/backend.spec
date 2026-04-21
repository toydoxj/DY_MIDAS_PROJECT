# -*- mode: python ; coding: utf-8 -*-

import os

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        (os.path.join('..', 'gmaps.env'), '.'),
        (os.path.join('..', 'MIDAS_API'), 'MIDAS_API'),
        (os.path.join('..', 'frontend', 'out'), 'frontend_out'),
        ('routers', 'routers'),
        ('models', 'models'),
        ('engines', 'engines'),
        ('data', 'data'),
    ],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.http.httptools_impl',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.protocols.websockets.wsproto_impl',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        'multipart',
        'python_multipart',
        'work_dir',
        'db',
        'auth_middleware',
        'models.auth',
        'routers.auth',
        'sqlalchemy',
        'jose',
        'engines.seismic_cert_hwpx',
        'models.seismic_cert',
        'routers.seismic_cert',
        # MIDAS_API 의존성 (datas로 포함된 패키지의 런타임 의존성)
        'requests',
        'pandas',
        'colorama',
        # midas-gen 공식 라이브러리 및 실제 사용 의존성
        'midas_gen',
        'numpy',
        'tqdm',
        'openpyxl',  # backend/routers/floorload.py 에서 lazy import
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # midas-gen이 pip requires-dist로 선언하나 실제 코드에서 import하지 않는 heavy 패키지 제거
    # (번들 ~200MB 감소, 실행시 Python startup 단축)
    excludes=[
        'polars',
        'polars_runtime_32',
        'scipy',
        'gmsh',
        'PIL',
        'Pillow',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='backend',
)

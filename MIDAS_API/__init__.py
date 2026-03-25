import requests
from colorama import Fore, Style
from ._midas_api import *
from ._to_excel import *
from ._projectDB import projectDB, structureTypeDB
from ._staticloads import loadCaseDB, selfWeightDB, loadToMassDB

_version_ = "0.0.1"
_author_ = "Jeong, Jihun"
_copyright_ = "Copyright 2026 Dongyang Consulting Engineering Co., Ltd."
_description_ = "MIDAS-API is a Python library for the MIDAS GEN NX API."




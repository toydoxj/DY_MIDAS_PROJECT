import os
import MIDAS_API as MIDAS
from dotenv import load_dotenv

load_dotenv()

MIDAS.MIDAS_API_BASEURL(os.environ["MIDAS_BASE_URL"])
MIDAS.MIDAS_API_KEY(os.environ["MIDAS_API_KEY"])

endpoint = "/db/STOR"
body = {
    "Argument": {
        "VIEW": {
            "UCS_AXIS": False,           # JSON true → Python True
            "VIEWPPORT_GIZMO": False,    # JSON true → Python True
            "VIEW_POINT": True,         # JSON true → Python True
            "DESCRIPTION": "VIEW2",
            "LABEL_ORIENTATION": 30
        }
    }
}

response = MIDAS.MidasAPI("GET", endpoint)

# 표 형태(DataFrame)로 확인
df = MIDAS.to_dataframe(response, id_col="KEY")
print(df)
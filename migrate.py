import os
import sys
import time
import pyodbc
from dotenv import load_dotenv

# Load variables from local environment or ConfigMap
load_dotenv()

# --- SETTINGS READ FROM ENVIRONMENT VARIABLES ---
DB_NAME = os.environ.get("DB_NAME", "Test_Wasim")
S3_BUCKET = os.environ.get("S3_BUCKET", "biryani-bucket-0027")

# Securely extract database credentials passed by the EKS Job
DB_SERVER = os.environ.get("DB_SERVER")
DB_USER = os.environ.get("DB_USER")
DB_PASS = os.environ.get("DB_PASS")

# Validate critical database connectivity details before executing commands
if not all([DB_SERVER, DB_USER, DB_PASS]):
    print("❌ CRITICAL: Missing required database configuration values (DB_SERVER, DB_USER, DB_PASS).")
    sys.exit(1)

# Build the private connection string targeting the internal master system catalog
RDS_CONN_STR = (
    f"DRIVER={{ODBC Driver 18 for SQL Server}};"
    f"Server={DB_SERVER},1433;"
    f"Database=master;"
    f"UID={DB_USER};"
    f"PWD={DB_PASS};"
    f"Encrypt=yes;"
    f"TrustServerCertificate=yes;"
)


def execute_query(connection_string, query, fetch=False):
    """Executes a SQL statement on RDS with autocommit enabled."""
    conn = pyodbc.connect(connection_string)
    conn.autocommit = True
    cursor = conn.cursor()
    cursor.execute(query)
    result = cursor.fetchall() if fetch else None
    cursor.close()
    conn.close()
    return result


def initiate_rds_restore():
    print(f"Connecting to RDS and triggering native S3 restore for bucket: '{S3_BUCKET}'...")
    # Targets your exact .bak file path in the bucket root directory
    s3_arn = f"arn:aws:s3:::{S3_BUCKET}/Election_WB_2026.bak"
    
    restore_query = f"""
    EXEC msdb.dbo.rds_restore_database
        @restore_db_name='{DB_NAME}',
        @s3_arn_to_restore_from='{s3_arn}';
    """
    execute_query(RDS_CONN_STR, restore_query)
    print("SUCCESS: AWS RDS restore task successfully registered.")


def monitor_restore():
    print("Monitoring AWS RDS migration progress loop...")
    status_query = "EXEC msdb.dbo.rds_task_status;"
    
    while True:
        try:
            rows = execute_query(RDS_CONN_STR, status_query, fetch=True)
        except Exception as query_err:
            print(f"⚠️ Warning: Connection glitch while reading task status: {query_err}. Retrying...")
            time.sleep(15)
            continue

        if not rows:
            print("Waiting for task list to populate...")
            time.sleep(10)
            continue
            
        target_task = None
        for row in rows:
            if DB_NAME in str(row):
                target_task = row
                break
                
        if not target_task:
            target_task = rows[0] if rows else None
            
        if target_task:
            try:
                # pyodbc response mapping positions: 4 = % complete, 5 = Status, 6 = Message
                percent_complete = target_task[4]
                lifecycle_status = str(target_task[5]).strip().upper()
                comment = target_task[6]
                print(f"--> Status: {lifecycle_status} | Progress: {percent_complete}% | Logs: {comment}")
                
                if lifecycle_status == "SUCCESS":
                    print(f"SUCCESS: Database '{DB_NAME}' has completely migrated to AWS RDS!")
                    break
                elif lifecycle_status in ["ERROR", "CANCELLED", "FAIL"]:
                    print(f"ERROR: Migration failed inside AWS environment. Reason: {comment}")
                    sys.exit(1)
            except Exception as parse_ex:
                print(f"--> Status Update Parsing Note: {target_task} | Details: {parse_ex}")
                
        time.sleep(20)


if __name__ == "__main__":
    try:
        initiate_rds_restore()
        monitor_restore()
    except Exception as e:
        print(f"CRITICAL: Migration Pipeline Aborted: {e}")
        sys.exit(1)

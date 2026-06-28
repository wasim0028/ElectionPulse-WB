import os
import time
import boto3
import pyodbc
from dotenv import load_dotenv

# Load variables from local .env file (safely ignored by git)
load_dotenv()

# --- SETTINGS READ FROM ENVIRONMENT VARIABLES ---
DB_NAME = os.environ.get("DB_NAME", "Test_Wasim")
BACKUP_PATH = os.environ.get("BACKUP_PATH")

AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")
S3_BUCKET = os.environ.get("S3_BUCKET", "biryani-bucket-0027")
S3_KEY = f"backups/{DB_NAME}.bak"

# Securely extract database credentials
DB_SERVER = os.environ.get("DB_SERVER")
DB_USER = os.environ.get("DB_USER")
DB_PASS = os.environ.get("DB_PASS")

# Build the connection string safely using f-strings
RDS_CONN_STR = (
    f"DRIVER={{ODBC Driver 18 for SQL Server}};"
    f"Server={DB_SERVER},1433;"
    f"Database=master;"
    f"UID={DB_USER};"
    f"PWD={DB_PASS};"
    f"Encrypt=yes;"
    f"TrustServerCertificate=yes;"
)

# --- AWS CLIENT SETUP ---
# Reads keys implicitly from environment variables or local configurations
s3_client = boto3.client(
    's3',
    region_name=AWS_REGION,
    aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY")
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


def step_1_upload_to_s3():
    print(f"[1/3] Uploading local backup file to S3 bucket '{S3_BUCKET}'...")
    if not BACKUP_PATH or not os.path.exists(BACKUP_PATH):
        raise FileNotFoundError(f"Could not locate the backup file at: {BACKUP_PATH}")
        
    s3_client.upload_file(BACKUP_PATH, S3_BUCKET, S3_KEY)
    print(f"SUCCESS: Upload complete! File is now in S3: s3://{S3_BUCKET}/{S3_KEY}")


def step_2_initiate_rds_restore():
    print(f"[2/3] Contacting RDS to trigger the native S3 restore process...")
    s3_arn = f"arn:aws:s3:::{S3_BUCKET}/{S3_KEY}"
    
    restore_query = f"""
    EXEC msdb.dbo.rds_restore_database
        @restore_db_name='{DB_NAME}',
        @s3_arn_to_restore_from='{s3_arn}';
    """
    execute_query(RDS_CONN_STR, restore_query)
    print("SUCCESS: AWS RDS restore task successfully registered.")


def step_3_monitor_restore():
    print("[3/3] Monitoring AWS RDS migration progress loop...")
    status_query = "EXEC msdb.dbo.rds_task_status;"
    
    while True:
        rows = execute_query(RDS_CONN_STR, status_query, fetch=True)
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
            target_task = rows if rows else None
            
        if target_task:
            try:
                percent_complete = target_task[4]
                lifecycle_status = target_task[5]
                comment = target_task[6]
                print(f"--> Status: {lifecycle_status} | Progress: {percent_complete}% | Logs: {comment}")
                
                if str(lifecycle_status).strip() == "SUCCESS":
                    print(f"SUCCESS: Database '{DB_NAME}' has completely migrated to AWS RDS!")
                    break
                elif str(lifecycle_status).strip() == "ERROR":
                    print(f"ERROR: Migration failed inside AWS environment. Reason: {comment}")
                    break
            except Exception:
                print(f"--> Status Update: {target_task}")
                
        time.sleep(20)


if __name__ == "__main__":
    try:
        # step_1_upload_to_s3()
        step_2_initiate_rds_restore()
        step_3_monitor_restore()
    except Exception as e:
        print(f"CRITICAL: Migration Pipeline Aborted: {e}")

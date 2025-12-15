# MySQL Setup Guide for Vanguard NIDS

## Step 1: Install MySQL

### Windows
1. Download MySQL Installer from: https://dev.mysql.com/downloads/installer/
2. Run the installer and select "Developer Default"
3. Complete the installation wizard
4. Set a root password (remember this!) 

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install mysql-server
sudo mysql_secure_installation
```

### macOS
```bash
brew install mysql
brew services start mysql
```

## Step 2: Create Database

1. **Start MySQL:**
   ```bash
   # Windows: MySQL should start automatically
   # Linux: sudo systemctl start mysql
   # macOS: brew services start mysql
   ```

2. **Login to MySQL:**
   ```bash
   mysql -u root -p
   ```

3. **Create Database and User:**
   ```sql
   CREATE DATABASE vanguard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   
   CREATE USER 'vanguard_user'@'localhost' IDENTIFIED BY 'your_password_here';
   
   GRANT ALL PRIVILEGES ON vanguard.* TO 'vanguard_user'@'localhost';
   
   FLUSH PRIVILEGES;
   
   EXIT;
   ```

## Step 3: Install Python MySQL Driver

```bash
# Activate your virtual environment first
pip install pymysql
```

Or add to `requirements.txt`:
```
pymysql==1.1.0
```

## Step 4: Configure Vanguard

### Option 1: Environment Variables (Recommended)

Create or update `.env` file in `backend/` directory:

```env
# MySQL Configuration
DATABASE_URL=mysql+pymysql://vanguard_user:your_password_here@localhost:3306/vanguard

# Or use individual settings:
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=vanguard_user
MYSQL_PASSWORD=your_password_here
MYSQL_DATABASE=vanguard
```

### Option 2: Direct Configuration

Edit `backend/app/config.py`:

```python
DATABASE_URL: str = "mysql+pymysql://vanguard_user:your_password@localhost:3306/vanguard"
```

## Step 5: Initialize Database

```bash
cd backend
python -m app.database
```

This will create all necessary tables in your MySQL database .

## Step 6: Verify Connection

Test the connection:

```python
from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text("SELECT 1"))
    print("✓ MySQL connection successful!")
```

## Troubleshooting

### Connection Refused
- Check MySQL is running: `sudo systemctl status mysql` (Linux)
- Verify port 3306 is open
- Check firewall settings

### Access Denied
- Verify username and password
- Check user has privileges: `SHOW GRANTS FOR 'vanguard_user'@'localhost';`
- Try resetting password: `ALTER USER 'vanguard_user'@'localhost' IDENTIFIED BY 'new_password';`

### Module Not Found
- Install pymysql: `pip install pymysql`
- Verify it's in your virtual environment

### Character Encoding Issues
- Ensure database uses utf8mb4:
  ```sql
  ALTER DATABASE vanguard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  ```

## Connection String Format

```
mysql+pymysql://[username]:[password]@[host]:[port]/[database]
```

Example:
```
mysql+pymysql://vanguard_user:mypassword@localhost:3306/vanguard
```

## Security Notes

1. **Never commit passwords to git** - Use `.env` file and add it to `.gitignore`
2. **Use strong passwords** for production
3. **Limit user privileges** - Only grant necessary permissions
4. **Use SSL** for production connections

## Switching Back to SQLite

If you want to switch back to SQLite:

```env
DATABASE_URL=sqlite:///./vanguard.db
```

Then reinitialize:
```bash
python -m app.database
```


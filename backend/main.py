from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
import numpy as np
import requests
import anthropic
from datetime import datetime
import os
from typing import Optional
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles

# ========================== INIT CONFIGURATION ===========================

# Load environment variables từ file .env
load_dotenv()

# Hàm load system prompts từ file txt riêng biệt (giúp dễ bảo trì)
def load_prompt(filename):
    with open(filename, "r", encoding="utf-8") as f:
        return f.read()

# Load nội dung system prompt từ file text
NAME_SYSTEM_PROMPT = load_prompt("name_system_prompt.txt")
ANALYSIS_SYSTEM_PROMPT = load_prompt("analysis_system_prompt.txt")

# ========================== INIT FASTAPI APP ===========================

# Khởi tạo app FastAPI
app = FastAPI(title="Crypto Analysis API", version="1.0.0")

# Bật CORS cho phép frontend truy cập API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Khởi tạo Anthropic client
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# ========================== DEFINE REQUEST - RESPONSE MODELS ===========================

# Model request nhận từ frontend
class ChatRequest(BaseModel):
    message: str

# Model response trả về cho frontend
class ChatResponse(BaseModel):
    response: str
    coin: Optional[str] = None
    symbol: Optional[str] = None
    data_points: Optional[int] = None

# ========================== BINANCE DATA & INDICATOR FUNCTIONS ===========================

# Hàm lấy dữ liệu nến từ Binance
def get_binance_klines(symbol: str, interval: str = "1d", limit: int = 200):
    try:
        url = "https://api.binance.com/api/v3/klines"
        params = {"symbol": symbol, "interval": interval, "limit": limit}
        response = requests.get(url, params=params)
        if response.status_code != 200:
            print(f"❌ Binance API error: {response.status_code}")
            return None
        data = response.json()
        if not data:
            print("❌ No data returned from Binance")
            return None
        # Parse về DataFrame
        df = pd.DataFrame(data, columns=[
            'timestamp', 'open', 'high', 'low', 'close', 'volume',
            'close_time', 'quote_volume', 'count', 'taker_buy_volume',
            'taker_buy_quote_volume', 'ignore'])
        df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')
        numeric_cols = ['open', 'high', 'low', 'close', 'volume']
        df[numeric_cols] = df[numeric_cols].astype(float)
        df = calculate_technical_indicators(df)
        return df
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {e}")
        return None
    except Exception as e:
        print(f"❌ Error processing Binance data: {e}")
        return None

# Hàm tính EMA
def calculate_ema(data, period):
    return data.ewm(span=period, adjust=False).mean()

# Hàm tính RSI
def calculate_rsi(data, period):
    delta = data.diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    avg_gain = gain.ewm(alpha=1/period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, adjust=False).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

# Hàm tính MACD
def calculate_macd(data, fast_period=12, slow_period=26, signal_period=9):
    ema_fast = calculate_ema(data, fast_period)
    ema_slow = calculate_ema(data, slow_period)
    macd_line = ema_fast - ema_slow
    signal_line = calculate_ema(macd_line, signal_period)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram

# Tính toàn bộ chỉ báo kỹ thuật cần thiết
def calculate_technical_indicators(df):
    if len(df) < 50:
        print("⚠️ Not enough data for technical indicators")
        return df
    df['ema_7'] = calculate_ema(df['close'], 7)
    df['ema_25'] = calculate_ema(df['close'], 25)
    df['ema_50'] = calculate_ema(df['close'], 50)
    df['rsi_6'] = calculate_rsi(df['close'], 6)
    df['rsi_12'] = calculate_rsi(df['close'], 12)
    df['rsi_24'] = calculate_rsi(df['close'], 24)
    macd_line, signal_line, histogram = calculate_macd(df['close'])
    df['macd_line'] = macd_line
    df['macd_signal'] = signal_line
    df['macd_histogram'] = histogram
    df['volume_ma'] = df['volume'].rolling(window=20).mean()
    return df

# Format dữ liệu kỹ thuật chuyển sang text cho Claude

def format_comprehensive_analysis_data(df, coin_name):
    if df is None or len(df) < 50:
        return None

    recent_data = df.tail(20)  # lấy 20 cây nến gần nhất
    analysis_text = f"""
PHÂN TÍCH KỸ THUẬT {coin_name}/USDT - KHUNG THỜI GIAN 1D (20 phiên gần nhất)

Dữ liệu kỹ thuật dưới đây bao gồm giá đóng cửa, các đường trung bình động EMA, chỉ báo RSI, MACD và khối lượng giao dịch. Hãy phân tích xu hướng, hỗ trợ - kháng cự, tín hiệu mua bán, xác suất các kịch bản có thể xảy ra.

| Ngày | Close | EMA7 | EMA25 | EMA50 | RSI6 | RSI12 | RSI24 | MACD | Signal | Histogram | Volume |
|---|---|---|---|---|---|---|---|---|---|---|---|
"""

    for idx, row in recent_data.iterrows():
        analysis_text += f"| {row['timestamp'].date()} | {row['close']:.4f} | {row['ema_7']:.4f} | {row['ema_25']:.4f} | {row['ema_50']:.4f} | {row['rsi_6']:.2f} | {row['rsi_12']:.2f} | {row['rsi_24']:.2f} | {row['macd_line']:.4f} | {row['macd_signal']:.4f} | {row['macd_histogram']:.4f} | {row['volume']:.0f} |\n"

    return analysis_text

# ========================== MAIN API ENDPOINT ===========================

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

# API chính: nhận message -> trích xuất coin -> lấy dữ liệu -> phân tích
@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    try:
        print(f"📨 Receive message: {req.message}")

        # Kiểm tra API key
        if not os.getenv("ANTHROPIC_API_KEY"):
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")
        
        # Bước 1: Trích xuất tên coin từ prompt NAME_SYSTEM_PROMPT
        name_response = client.messages.create(
            model="claude-4-sonnet-20250514",
            max_tokens=100,
            temperature=0.3,
            system=NAME_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": req.message}]
        )
        coin_name = name_response.content[0].text.strip()
        print(f"🪙 Detected coin: {coin_name}")
        
        # Bước 2: Lấy dữ liệu Binance
        symbol = f"{coin_name}USDT"
        df = get_binance_klines(symbol, "1d", 997)
        if df is None:
            return ChatResponse(response="Mình chưa nhận diện được tên coin cần phân tích.")
        
        # Bước 3: Chuẩn bị dữ liệu kỹ thuật
        comprehensive_data = format_comprehensive_analysis_data(df, coin_name)
        if comprehensive_data is None:
            return ChatResponse(response="❌ Không đủ dữ liệu để phân tích. Vui lòng thử lại sau.")
        
        # Bước 4: Gọi Claude phân tích kỹ thuật toàn diện
        analysis_response = client.messages.create(
            model="claude-4-sonnet-20250514",
            max_tokens=4000,
            temperature=0.7,
            system=ANALYSIS_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": comprehensive_data}]
        )
        analysis_result = analysis_response.content[0].text
        print("✅ Analysis completed")

        # Trả về kết quả phân tích cho frontend
        return ChatResponse(
            response=analysis_result,
            coin=coin_name,
            symbol=symbol,
            data_points=len(df)
        )

    except anthropic.APIError as e:
        print(f"❌ Anthropic API error: {e}")
        raise HTTPException(status_code=500, detail=f"Anthropic API error: {str(e)}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# ========================== SERVE FRONTEND ===========================

# Mount frontend static nếu có build sẵn
if os.path.isdir("frontend/build"):
    app.mount("/", StaticFiles(directory="frontend/build", html=True), name="static")

# ========================== RUN SERVER ===========================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

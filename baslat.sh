#!/bin/bash
# HaYTool Youtube Download - Unix Başlatıcı Betiği
# Yapımcı: HaYTo
# İletişim: korazhayto@gmail.com

# Çalışma dizinini betiğin bulunduğu dizin olarak ayarla
cd "$(dirname "$0")"

# Türkçe Açıklama: configunix.ini dosyasından port değerini dinamik olarak okur, bulamazsa varsayılan 3000 portunu kullanır.
PORT=3000
CONFIG_FILE="configunix.ini"
if [ -f "$CONFIG_FILE" ]; then
    PORT_VAL=$(grep -i '^port[[:space:]]*=' "$CONFIG_FILE" | cut -d'=' -f2 | tr -d ' \r\n')
    if [ ! -z "$PORT_VAL" ]; then
        PORT=$PORT_VAL
    fi
fi

# Türkçe Açıklama: Belirlenen portun başka bir süreç tarafından kullanılıp kullanılmadığını denetler.
PORT_PID=$(lsof -t -i:$PORT 2>/dev/null)
if [ -z "$PORT_PID" ]; then
    PORT_PID=$(fuser $PORT/tcp 2>/dev/null | tr -d ' ')
fi

if [ ! -z "$PORT_PID" ]; then
    # Süreç ismini tespit et
    PNAME=$(ps -p $PORT_PID -o comm= 2>/dev/null)
    
    # Uyarı ekranını göster
    echo -e "\e[31m  ====================================================\e[0m"
    echo -e "\e[31m  [UYARI] Port $PORT şu anda başka bir işlem tarafından kullanılıyor!\e[0m"
    echo -e "\e[31m  İşlem ID (PID): $PORT_PID\e[0m"
    echo -e "\e[31m  Uygulama Adı  : $PNAME\e[0m"
    echo -e "\e[31m  ====================================================\e[0m"
    echo ""
    echo "  [1] İşlemi sonlandır (kill -9) ve sunucuyu başlat"
    echo "  [2] İşlemi sonlandırma ve çık"
    echo ""
    read -p "  Seçiminiz (1 veya 2): " CHOICE

    if [ "$CHOICE" = "1" ]; then
        echo ""
        echo -e "  \e[33m[+] Portu kullanan işlem ($PNAME - PID: $PORT_PID) sonlandırılıyor...\e[0m"
        kill -9 $PORT_PID
        sleep 2
        clear
    else
        echo ""
        echo -e "  \e[31m[-] Port çakışması giderilmedi. Uygulama başlatılamıyor.\e[0m"
        exit 1
    fi
fi

# Başlangıç ekranı logoları ve bilgileri
echo -e "\e[33m  ====================================================\e[0m"
echo -e "\e[33m  _    _         __     __ _______  ___   ___   _     \e[0m"
echo -e "\e[33m | |  | |  __ _  \\ \\   / /|__   __|/ _ \\ / _ \\ | |    \e[0m"
echo -e "\e[33m | |__| | / _\` |  \\ \\_/ /    | |  | (_) | (_) || |    \e[0m"
echo -e "\e[33m |  __  || (_| |   \\   /     | |   \\___/ \\___/ | |    \e[0m"
echo -e "\e[33m | |  | | \\__,_|    | |      | |               | |____\e[0m"
echo -e "\e[33m |_|  |_|           |_|      |_|               |______|\e[0m"
echo ""
echo -e "\e[33m             -- Premium Otomasyonu --\e[0m"
echo -e "\e[33m             Versiyon: v4.5\e[0m"
echo -e "\e[33m  ====================================================\e[0m"
echo ""
echo -e "  \e[32m[+] Sunucu Port: $PORT denetleniyor...\e[0m"
echo -e "  \e[32m[+] Tarayıcı bağlantısı hazırlanıyor...\e[0m"
echo -e "  \e[32m[+] Kapatmak için bu pencereyi kapatabilir veya Ctrl+C yapabilirsiniz.\e[0m"
echo ""
echo -e "  \e[34m----------------------------------------------------\e[0m"
echo -e "  \e[34m[Sistem] Arayüz başlatılıyor...\e[0m"
echo -e "  \e[34m----------------------------------------------------\e[0m"
echo ""

# Uygulamayı başlat
npm start

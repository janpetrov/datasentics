
# Použití aplikací

# 1. Stáhnutí dat
Buňka pod nadpisem **1. Scrape Source Texts from Wikipedia** v souboru **make_evaluate.ipynb** postahuje do souboru data_scraped/scraped_texts.json texty z Wikipedie týkající se všech států světa.

# 2. Vygenerování obrázků
Buňka pod nadpisem **2. Generate Images** v souboru **make_evaluate.ipynb** vygeneruje do adresáře blocks_images obrázky simulující pestrý text vytištěný na stránce. Vedle bloků plného textu text obsahuje i jedno samostatné číslo (např. se může jednat o ID dokumentu), na které se další úlohy zaměří přednostně.

# 3. OCR frontend
Webová stránka **numbers_extract.html** (s doprovodným .css souborem a zejména souborem **numbers_extract.js** obsahující vlastní program) slouží uživateli k tomu, aby vybral soubory ze svého disku. Aplikace prostřednictvím veřejně dostupného API OCR (omluvte prosím případné delší tvrání či případnou nemožnost odeslat najednou více než desítky souborů) umožňuje uživateli najednou vybrat více souborů a získat extrakci čísel z nich. aplikace netriviálně zpracovává výstup API, zobrazuje jej a umožňuje jej uživateli stáhnout v .txt souboru.

# 4. Vyhodnocení OCR
K vyhodnocení extrakce na vygenerovaných obrázcích slouží buňky pod nadpisem **4. Evaluation of OCR Retrieval** v souboru **make_evaluate.ipynb**. Zde se předpokládá, že výsledky kroku 3. byly uloženy do souboru **extracted_numbers.txt** ve stejném adresáři jako uvedený **.ipynb** soubor. 

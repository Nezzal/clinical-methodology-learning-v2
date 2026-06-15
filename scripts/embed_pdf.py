import os
import json
import time
import urllib.request
import urllib.error
from pypdf import PdfReader

# Configuration
WORKSPACE_DIR = "/Users/mac/Projects/ClinicalMethodologyLearning"
OUTPUT_JSON_PATH = "src/data/recif-embeddings.json"
MODEL_NAME = "models/gemini-embedding-2"
BATCH_SIZE = 20  # Let's keep it safe for rate limits and payload sizes

def load_gemini_api_key():
    """Charge la clé API de Gemini depuis .env.local ou l'environnement."""
    key = os.environ.get("GEMINI_API_KEY", "")
    if key:
        return key
    
    # Tenter de lire depuis .env.local
    if os.path.exists(".env.local"):
        with open(".env.local", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("GEMINI_API_KEY="):
                    parts = line.split("=", 1)
                    if len(parts) > 1:
                        # Enlever d'éventuels guillemets
                        return parts[1].strip("'\" ")
    return ""

def clean_text(text, doc_name=None):
    """Nettoie le texte extrait pour éliminer les espaces superflus."""
    if not text:
        return ""
    # Remplacer les retours à la ligne simples par des espaces, mais garder les paragraphes
    lines = [line.strip() for line in text.split("\n")]
    # Supprimer les lignes vides ou trop courtes (bruits de numéros de pages ou en-têtes répétitifs)
    cleaned_lines = []
    for line in lines:
        if not line:
            continue
        # Ignorer les lignes contenant uniquement des numéros (pages)
        if line.isdigit():
            continue
        # Ignorer les en-têtes courants du RECIF si c'est le manuel RECIF
        if doc_name and "RECIF" in doc_name.upper():
            if "RECHERCHE CLINIQUE ET EPIDEMIOLOGIQUE" in line.upper() or "CONCEPTION REDACTION FAISABILITE" in line.upper():
                continue
        cleaned_lines.append(line)
        
    # Recomposer le texte
    joined = " ".join(cleaned_lines)
    # Supprimer les espaces multiples
    return " ".join(joined.split())

def chunk_pdf(pdf_path, doc_name):
    """Lit le PDF et le découpe en paragraphes cohérents par page."""
    print(f"📖 Lecture du fichier PDF : {pdf_path} ({doc_name})...")
    reader = PdfReader(pdf_path)
    chunks = []
    
    # On commence à la page 1 (l'index 0 de reader.pages)
    for page_idx, page in enumerate(reader.pages):
        page_num = page_idx + 1
        text = page.extract_text()
        if not text:
            continue
        
        # Séparer par paragraphes (généralement \n\n ou grands espaces)
        # Comme l'extraction fusionne parfois les lignes, on va nettoyer d'abord par blocs
        # puis faire un découpage basé sur la taille si besoin
        cleaned = clean_text(text, doc_name)
        if len(cleaned) < 50:
            continue  # Trop court pour avoir du sens
            
        # Diviser le texte de la page en morceaux d'environ 1800 caractères avec un recouvrement de 300 caractères
        # Cela évite de couper au milieu d'une idée importante
        chunk_size = 1800
        overlap = 300
        
        start = 0
        while start < len(cleaned):
            end = start + chunk_size
            # Si le découpage tombe au milieu d'un mot, on essaie de trouver un espace ou une fin de phrase
            if end < len(cleaned):
                # Chercher le point le plus proche dans les 100 caractères suivants/précédents
                search_limit = 100
                found_split = False
                for offset in range(search_limit):
                    # Chercher un point (fin de phrase)
                    if cleaned[end - offset] == '.' and cleaned[end - offset + 1] == ' ':
                        end = end - offset + 1
                        found_split = True
                        break
                if not found_split:
                    for offset in range(search_limit):
                        # Chercher un espace
                        if cleaned[end - offset] == ' ':
                            end = end - offset
                            found_split = True
                            break
            
            chunk_text = cleaned[start:end].strip()
            if len(chunk_text) > 40:  # Seulement si le chunk est significatif
                chunks.append({
                    "doc": doc_name,
                    "page": page_num,
                    "text": chunk_text
                })
                
            start = end - overlap
            if start >= len(cleaned) - overlap:
                break
                
    print(f"✅ Découpage terminé. Nombre total de paragraphes générés : {len(chunks)}")
    return chunks

def get_embeddings_batch(chunks, api_key):
    """Génère les embeddings pour une liste de chunks par lots (batch API)."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:batchEmbedContents?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    embedded_chunks = []
    total = len(chunks)
    
    for i in range(0, total, BATCH_SIZE):
        batch = chunks[i:i + BATCH_SIZE]
        print(f"⚡ Envoi du lot {i//BATCH_SIZE + 1}/{-(-total//BATCH_SIZE)} (chunks {i} à {min(i+BATCH_SIZE, total)} sur {total})...")
        
        requests_payload = []
        for c in batch:
            requests_payload.append({
                "model": MODEL_NAME,
                "content": {
                    "parts": [{"text": c["text"]}]
                },
                "outputDimensionality": 768
            })
            
        data = {"requests": requests_payload}
        req_data = json.dumps(data).encode("utf-8")
        req = urllib.request.Request(url, data=req_data, headers=headers, method="POST")
        
        max_retries = 5
        retry = 0
        while retry < max_retries:
            try:
                with urllib.request.urlopen(req, timeout=30.0) as response:
                    res_data = json.loads(response.read().decode("utf-8"))
                    embeddings = res_data.get("embeddings", [])
                    
                    for idx, emb_data in enumerate(embeddings):
                        vector = emb_data.get("values", [])
                        embedded_chunks.append({
                            "doc": batch[idx].get("doc"),
                            "page": batch[idx]["page"],
                            "text": batch[idx]["text"],
                            "embedding": vector
                        })
                    break  # Sortir de la boucle si succès
            except urllib.error.HTTPError as e:
                err_content = e.read().decode('utf-8', errors='ignore')
                if e.code == 429:
                    sleep_time = 45.0  # par défaut
                    try:
                        err_json = json.loads(err_content)
                        details = err_json.get("error", {}).get("details", [])
                        for detail in details:
                            if "retryDelay" in detail:
                                delay_str = detail["retryDelay"]
                                if delay_str.endswith("s"):
                                    sleep_time = float(delay_str[:-1]) + 2.0
                                    break
                    except Exception:
                        pass
                    print(f"⏳ Quota épuisé (429). Sommeil forcé de {sleep_time:.1f} secondes avant de réessayer le lot...")
                    time.sleep(sleep_time)
                    # Ne pas incrémenter retry pour les 429
                    continue
                else:
                    retry += 1
                    print(f"❌ Erreur HTTP lors de l'appel API (tentative {retry}/{max_retries}): {e.code} - {err_content}")
                    if retry < max_retries:
                        time.sleep(2 ** retry)
                    else:
                        raise e
            except Exception as e:
                retry += 1
                print(f"❌ Autre erreur lors de l'appel API (tentative {retry}/{max_retries}): {e}")
                if retry < max_retries:
                    time.sleep(2 ** retry)
                else:
                    raise e
                    
        # Petite pause pour éviter de saturer les limites de taux de l'API
        time.sleep(0.5)
        
    return embedded_chunks

def find_pdfs(workspace_dir):
    """Trouve tous les fichiers PDF dans le répertoire de travail."""
    pdfs = []
    for file in os.listdir(workspace_dir):
        if file.lower().endswith(".pdf"):
            pdfs.append(os.path.join(workspace_dir, file))
    # Trier pour avoir un traitement reproductible (ex: RECIF d'abord ou ordre alphabétique)
    pdfs.sort()
    return pdfs

def get_doc_name(pdf_path):
    """Génère un nom de document lisible à partir du nom du fichier."""
    base = os.path.basename(pdf_path)
    name_without_ext, _ = os.path.splitext(base)
    # Remplacements et nettoyage simples
    cleaned = name_without_ext.replace("_", " ").replace("-", " ").strip()
    # Cas spécifiques
    if "RECIF" in cleaned.upper():
        return "Manuel RECIF"
    if "18 11" in cleaned or "SANTE" in cleaned.upper():
        return "Loi n° 18-11 relative à la santé"
    return cleaned

def main():
    api_key = load_gemini_api_key()
    if not api_key:
        print("❌ Erreur : La clé GEMINI_API_KEY n'a pas été trouvée dans l'environnement ni dans .env.local.")
        print("Veuillez configurer GEMINI_API_KEY dans app/.env.local avant d'exécuter ce script.")
        return
        
    print(f"🔑 Clé API détectée : {api_key[:5]}...{api_key[-5:] if len(api_key) > 10 else ''}")
    
    # 1. Détecter tous les PDF du workspace
    pdf_paths = find_pdfs(WORKSPACE_DIR)
    if not pdf_paths:
        print(f"❌ Aucun fichier PDF trouvé dans {WORKSPACE_DIR}")
        return
        
    print(f"📂 {len(pdf_paths)} document(s) PDF détecté(s) à indexer :")
    for path in pdf_paths:
        print(f" - {os.path.basename(path)} -> {get_doc_name(path)}")
        
    # 2. Découper tous les PDF en paragraphes
    all_chunks = []
    for path in pdf_paths:
        doc_name = get_doc_name(path)
        chunks = chunk_pdf(path, doc_name)
        all_chunks.extend(chunks)
        
    print(f"\n📦 Nombre total combiné de paragraphes à indexer : {len(all_chunks)}")
    
    # 3. Générer les embeddings
    start_time = time.time()
    try:
        embedded_chunks = get_embeddings_batch(all_chunks, api_key)
        
        # 4. Sauvegarder dans le fichier JSON
        os.makedirs(os.path.dirname(OUTPUT_JSON_PATH), exist_ok=True)
        with open(OUTPUT_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(embedded_chunks, f, ensure_ascii=False, indent=2)
            
        duration = time.time() - start_time
        print(f"\n🎉 Succès ! Indexation terminée en {duration:.2f} secondes.")
        print(f"💾 Fichier sauvegardé sous : {OUTPUT_JSON_PATH} ({len(embedded_chunks)} vecteurs indexés)")
        
    except Exception as e:
        print(f"❌ Échec de la génération des embeddings : {e}")

if __name__ == "__main__":
    main()

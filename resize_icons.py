from PIL import Image
import os

def resize_icons():
    # Tamanhos necessários para os ícones
    sizes = [16, 48, 128]
    
    # Diretório dos ícones
    icon_dir = 'icons'
    
    # Verifica se existe um arquivo PNG de origem
    source_file = os.path.join(icon_dir, 'icon.png')
    if not os.path.exists(source_file):
        print("Erro: Arquivo fonte 'icon128.png' não encontrado na pasta 'icons'")
        return
    
    # Abre a imagem fonte
    try:
        img = Image.open(source_file)
        
        # Redimensiona para cada tamanho necessário
        for size in sizes:
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            output_file = os.path.join(icon_dir, f'icon{size}.png')
            resized.save(output_file, 'PNG')
            print(f"Ícone {size}x{size} criado com sucesso: {output_file}")
            
    except Exception as e:
        print(f"Erro ao processar imagens: {str(e)}")

if __name__ == "__main__":
    resize_icons() 
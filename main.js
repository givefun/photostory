import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import Base64 from 'base64-js';
import MarkdownIt from 'markdown-it';
import { maybeShowApiKeyBanner } from './gemini-api-banner';
import './style.css';

let API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

let form = document.querySelector('form');
let output = document.querySelector('.output');
let imageInput = document.querySelector('input[name="chosen-image"]');
let imagePreview = document.getElementById('chosen-image-preview');
let imageDropArea = document.getElementById('image-drop-area');

imageInput.onchange = () => {
  const file = imageInput.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      imagePreview.src = e.target.result;
      imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  } else {
    imagePreview.style.display = 'none';
  }
};

imageDropArea.addEventListener('paste', async (event) => {
  const items = (event.clipboardData || event.originalEvent.clipboardData).items;
  for (let item of items) {
    if (item.type.indexOf('image') !== -1) {
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.style.display = 'block';
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        imageInput.files = dataTransfer.files;
      };
      reader.readAsDataURL(file);
    }
  }
});

form.onsubmit = async (ev) => {
  ev.preventDefault();
  output.textContent = '생성 중...';

  try {
    // Load the image as a base64 string
    const file = imageInput.files[0];
    if (!file) {
      throw new Error('이미지를 업로드하거나 붙여넣으세요.');
    }
    const imageBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // 현재 언어에 따라 프롬프트 생성
    const currentLanguage = document.documentElement.lang;
    let promptText;

    if (currentLanguage === 'ko') {
      promptText = `업로드된 사진을 바탕으로 스릴러 영화 스토리 만들어주세요.
                    아래와 같은 요소들을 포함하여 흥미진진하고 긴장감 넘치는 스토리를 만들어 주세요:
                    영화제목:
                    영화사건배경: 
                    주인공:
                    주요 인물들:
                    주요 사건: 
                    반전 요소: 
                    추가 요소:
                    클라이막스:
                    결말:
                    전체 스토리 요약: 
                    한국어로 작성해주세요.`;
    } else {
      promptText = `Please create a thriller movie story based on the uploaded photo.
                    Include the following elements to create an exciting and suspenseful story:
                    Movie Title:
                    Setting:
                    Main Character:
                    Key Characters:
                    Major Events:
                    Plot Twist:
                    Additional Elements:
                    Climax:
                    Conclusion:
                    Overall Story Summary:
                    Please respond in English.`;
    }

    let contents = [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'image/jpeg', data: imageBase64, } },
          { text: promptText }
        ]
      }
    ];

    // Call the multimodal model, and get a stream of results
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // or gemini-1.5-pro
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_ONLY_SEVERE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_SEVERE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_SEVERE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_ONLY_SEVERE,
        }
      ],
    });

    const result = await model.generateContentStream({ contents });

    // Read from the stream and interpret the output as markdown
    let buffer = [];
    let md = new MarkdownIt();
    for await (let response of result.stream) {
      buffer.push(response.text());
      output.innerHTML = md.render(buffer.join(''));
    }
  } catch (e) {
    output.innerHTML += '<hr>' + e.message;
  }
};

// You can delete this once you've filled out an API key
maybeShowApiKeyBanner(API_KEY);

document.getElementById('language-toggle').addEventListener('click', () => {
  const currentLanguage = document.documentElement.lang;
  if (currentLanguage === 'ko') {
    document.documentElement.lang = 'en';
    document.getElementById('language-toggle').textContent = '한글 변환';
    document.getElementById('title').textContent = 'Create a Thriller Movie Story from a Photo';
    document.getElementById('upload-text').textContent = 'Select or Drag an Image';
    document.getElementById('paste-instructions').textContent = 'Upload a photo or paste an image using Ctrl-V.';
    document.getElementById('submit-button').textContent = 'Generate Story';
    document.getElementById('output-title').textContent = 'Generated Story';
    document.getElementById('output').textContent = '(The result will be displayed here)';
  } else {
    document.documentElement.lang = 'ko';
    document.getElementById('language-toggle').textContent = 'To English';
    document.getElementById('title').textContent = '사진 속에 숨겨진, 스릴러 영화 스토리';
    document.getElementById('upload-text').textContent = '이미지 선택, 드레그';
    document.getElementById('paste-instructions').textContent = '사진을 업로드하시거나, 단축키 Ctrl-V로 이미지를 붙여넣으세요.';
    document.getElementById('submit-button').textContent = '스토리 생성';
    document.getElementById('output-title').textContent = '생성 스토리';
    document.getElementById('output').textContent = '(결과가 여기에 표시됩니다)';
  }
});
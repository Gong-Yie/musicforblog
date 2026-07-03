# musicforblog

一个用于博客播放器的静态音乐歌单仓库。音乐、封面和 `list.json` 可以通过 GitHub Pages 直接读取。

## 在线地址

- 歌单 JSON: `https://gong-yie.github.io/musicforblog/list.json`
- 仓库地址: `https://github.com/Gong-Yie/musicforblog`
- 页面预览: `https://gong-yie.github.io/musicforblog/`

## 歌单格式

`list.json` 是一个数组，每首歌包含这些字段：

```json
{
  "name": "歌曲名",
  "artist": "艺术家",
  "url": "music/example.mp3",
  "cover": "cover/example.jpg"
}
```

其中 `url` 和 `cover` 都是相对于仓库根目录的路径。导入到博客时，需要拼接基础地址。

## 在博客中导入

推荐使用这个函数加载歌单：

```js
async function loadAudioList() {
  const sources = [
    {
      list: 'https://gong-yie.github.io/musicforblog/list.json',
      base: 'https://gong-yie.github.io/musicforblog/'
    },
    {
      list: 'https://cdn.jsdelivr.net/gh/Gong-Yie/musicforblog@master/list.json',
      base: 'https://cdn.jsdelivr.net/gh/Gong-Yie/musicforblog@master/'
    }
  ];

  for (const source of sources) {
    try {
      const response = await fetch(source.list);
      if (!response.ok) continue;

      const audioList = await response.json();
      return audioList.map(item => ({
        name: item.name || '未知歌曲',
        artist: item.artist || '未知艺术家',
        url: new URL(item.url, source.base).href,
        cover: item.cover
          ? new URL(item.cover, source.base).href
          : `https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(item.name || 'music')}`
      }));
    } catch (error) {
      console.warn('音乐源加载失败:', source.list, error);
    }
  }

  return [];
}
```

使用示例：

```js
const audioList = await loadAudioList();

// audioList 每一项格式：
// {
//   name: '歌曲名',
//   artist: '艺术家',
//   url: '完整 mp3 地址',
//   cover: '完整封面地址'
// }
```

## CDN 加速

默认主源是 GitHub Pages：

```txt
https://gong-yie.github.io/musicforblog/list.json
```

备用源可以使用 jsDelivr：

```txt
https://cdn.jsdelivr.net/gh/Gong-Yie/musicforblog@master/list.json
```

如果博客访问 GitHub Pages 较慢，可以优先使用 jsDelivr，或者在代码里保留两个源，主源失败后自动切换。

## 本地预览

安装依赖后运行：

```bash
npm install
npm start
```

然后打开：

```txt
http://127.0.0.1:8080/index.html
```

## 维护歌单

- 音乐文件放在 `music/`
- 封面文件放在 `cover/`
- 歌单记录写入 `list.json`
- 可以使用 `music_manager.py` 管理歌单和封面


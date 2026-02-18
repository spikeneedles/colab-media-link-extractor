# Contributing to Media Link Scanner 🐰

First off, thank you for considering contributing to Media Link Scanner! It's people like you that make this tool better for everyone.

## 🌟 How Can I Contribute?

### Reporting Bugs 🐛

Bugs are tracked as GitHub issues. When creating a bug report, please include:

**Required Information:**
- **Clear Title**: Descriptive summary of the issue
- **Description**: Detailed explanation of the problem
- **Steps to Reproduce**: Numbered list of steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Screenshots**: If applicable
- **Environment**: Browser, OS, Node version

**Example Bug Report:**
```markdown
**Title:** Archive extraction fails for password-protected ZIP files

**Description:** When uploading a password-protected ZIP file, the scanner hangs and doesn't show an error message.

**Steps to Reproduce:**
1. Create a password-protected ZIP file
2. Drag and drop it into the upload area
3. Wait for processing

**Expected:** Error message saying password-protected archives aren't supported
**Actual:** Infinite loading spinner, no error message

**Environment:**
- Browser: Chrome 120.0
- OS: Windows 11
- Node: 18.17.0
```

### Suggesting Features ✨

Feature requests are welcome! Please include:

- **Use Case**: Why is this feature needed?
- **Proposed Solution**: How should it work?
- **Alternatives**: Have you considered other approaches?
- **Additional Context**: Screenshots, examples, related issues

**Example Feature Request:**
```markdown
**Title:** Add support for Plex playlist format

**Use Case:** Many users have Plex media servers and would like to scan their playlists.

**Proposed Solution:** Add .plex file parsing similar to M3U parsing.

**Alternatives:** 
- Export Plex playlists to M3U first (current workaround)
- Integrate with Plex API directly

**Additional Context:** 
- Plex XML format documentation: [link]
- Example .plex file: [attachment]
```

### Pull Requests 🚀

We actively welcome your pull requests!

#### Process:

1. **Fork the Repository**
   ```bash
   git clone https://github.com/yourusername/media-link-scanner.git
   cd media-link-scanner
   git checkout -b feature/my-new-feature
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Make Your Changes**
   - Follow the code style guidelines below
   - Add tests if applicable
   - Update documentation

4. **Test Your Changes**
   ```bash
   npm run dev          # Test in development
   npm run build        # Ensure production build works
   npm run lint         # Check for linting errors
   ```

5. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add Plex playlist support"
   ```

6. **Push and Create PR**
   ```bash
   git push origin feature/my-new-feature
   # Then create a Pull Request on GitHub
   ```

## 📝 Code Style Guidelines

### TypeScript/React

**Naming Conventions:**
```typescript
// Components: PascalCase
function MediaPlayer() { }

// Functions: camelCase
function extractLinks() { }

// Constants: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 1024;

// Types/Interfaces: PascalCase
interface ScanResult { }
type MediaType = 'video' | 'audio';
```

**Component Structure:**
```typescript
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { extractLinks } from '@/lib/linkExtractor'

interface MyComponentProps {
  onComplete: (result: ScanResult) => void
}

export function MyComponent({ onComplete }: MyComponentProps) {
  const [state, setState] = useState<string>('')
  
  const handleAction = useCallback(() => {
    // Implementation
  }, [])
  
  return (
    <div className="space-y-4">
      <Button onClick={handleAction}>
        Action
      </Button>
    </div>
  )
}
```

**Best Practices:**
- Use functional components with hooks
- Memoize callbacks with `useCallback`
- Memoize expensive computations with `useMemo`
- Use TypeScript for all new code
- Avoid `any` types - use `unknown` or proper types
- Use optional chaining (`?.`) and nullish coalescing (`??`)

### CSS/Styling

**Tailwind Classes:**
```tsx
// ✅ Good: Semantic grouping
<div className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg">

// ❌ Avoid: Random order
<div className="px-4 flex bg-accent gap-2 items-center rounded-lg py-2 text-accent-foreground">
```

**Order:** Layout → Spacing → Sizing → Colors → Typography → Effects

### File Organization

```
src/
├── components/           # React components
│   ├── ui/              # Reusable UI components (shadcn)
│   └── [Feature].tsx    # Feature-specific components
├── lib/                 # Utility functions and logic
│   ├── [feature].ts     # Feature-specific logic
│   └── utils.ts         # General utilities
├── hooks/               # Custom React hooks
│   └── use-[name].ts    # Hook files
├── api/                 # Backend/API code
│   └── [endpoint].ts    # API endpoints
└── types/               # TypeScript type definitions
    └── [module].ts      # Type definition files
```

## 🧪 Testing

### Manual Testing Checklist

Before submitting a PR, test:

- [ ] File upload with various formats
- [ ] Folder upload with nested structure
- [ ] Archive extraction (ZIP, RAR, 7Z)
- [ ] URL validation with working/broken links
- [ ] Content classification and bulk editing
- [ ] Export functionality (all formats)
- [ ] Mobile responsiveness
- [ ] Dark/light mode switching
- [ ] AI assistant interaction

### Writing Tests (Future)

We're working on automated testing. When available:

```typescript
// Example test structure
describe('LinkExtractor', () => {
  it('should extract HTTP URLs from M3U content', () => {
    const content = '#EXTINF:-1,Channel\nhttp://example.com/stream.m3u8'
    const links = extractLinks(content)
    expect(links).toContain('http://example.com/stream.m3u8')
  })
})
```

## 📚 Documentation

### Code Comments

**When to Comment:**
- Complex algorithms
- Non-obvious business logic
- Workarounds for browser/library issues
- Performance optimizations

**When NOT to Comment:**
- Obvious code (`i++` // increment i)
- Type signatures (use TypeScript instead)
- Outdated information

**Good Comment Examples:**
```typescript
// Parse M3U8 playlist format, handling both standard and extended formats
// Reference: https://datatracker.ietf.org/doc/html/rfc8216
function parseM3U8(content: string) { }

// Workaround: Chrome doesn't support ReadableStream for large files
// Using FileReader instead for compatibility
if (isChrome && fileSize > MAX_SIZE) { }

// Performance: Process in chunks to avoid blocking UI thread
for (let i = 0; i < items.length; i += CHUNK_SIZE) { }
```

### README Updates

When adding features, update:
- Features section
- Usage examples
- Configuration options
- API reference (if applicable)

## 🎨 UI/UX Guidelines

### Design Principles

1. **Clarity Over Cleverness**: User should understand immediately
2. **Feedback Is Essential**: Every action gets visual feedback
3. **Consistency**: Similar actions should look and behave similarly
4. **Progressive Enhancement**: Core functionality works without JS

### Component Guidelines

**Buttons:**
```tsx
// Primary action: Accent color
<Button className="bg-accent hover:bg-accent/90">
  Download
</Button>

// Secondary action: Outline
<Button variant="outline">
  Cancel
</Button>

// Destructive action: Red
<Button variant="destructive">
  Delete
</Button>
```

**Loading States:**
```tsx
// Always show loading indicator
{isLoading && <RabbitLoader size={24} />}

// Disable interactive elements
<Button disabled={isLoading}>
  {isLoading ? 'Processing...' : 'Start'}
</Button>
```

**Error States:**
```tsx
// Show helpful error messages
{error && (
  <Alert variant="destructive">
    <AlertDescription>
      {error.message}
    </AlertDescription>
  </Alert>
)}
```

## 🔐 Security Guidelines

### Never Commit:
- API keys or secrets
- User credentials
- Personal information
- Large binary files

### Use Environment Variables:
```typescript
// ✅ Good
const apiKey = import.meta.env.VITE_API_KEY

// ❌ Bad
const apiKey = "sk-1234567890abcdef"
```

### Sanitize User Input:
```typescript
// ✅ Good
const sanitized = DOMPurify.sanitize(userInput)

// ❌ Bad
dangerouslySetInnerHTML={{ __html: userInput }}
```

## 📋 Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

**Format:**
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(scanner): add support for Plex playlist format

fix(validation): correct timeout calculation for slow servers

docs(readme): update installation instructions

style(components): format MediaPlayer component

refactor(extraction): optimize link detection algorithm

perf(validation): implement worker threads for parallel testing

test(scanner): add unit tests for M3U parser

chore(deps): update React to 19.2.0
```

## 🏆 Recognition

Contributors will be:
- Listed in README.md
- Mentioned in release notes
- Added to CONTRIBUTORS.md

## 📞 Getting Help

- **Discord**: [Join our community](#) (coming soon)
- **GitHub Discussions**: Ask questions
- **Email**: dev@example.com

## 📜 Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Examples of behavior that contributes to creating a positive environment:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Examples of unacceptable behavior:**
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without permission
- Other conduct which could reasonably be considered inappropriate

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting the project team. All complaints will be reviewed and investigated promptly and fairly.

## 🎯 Priority Areas

We're especially looking for contributions in:

1. **Testing**: Automated tests for core functionality
2. **Documentation**: More examples and tutorials
3. **Performance**: Optimization for large file sets
4. **Accessibility**: WCAG 2.1 AA compliance
5. **Mobile**: Enhanced mobile experience
6. **Internationalization**: Multi-language support

## 📝 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing! 🎉**

Every contribution, no matter how small, makes a difference. We appreciate your time and effort in making Media Link Scanner better for everyone.

Happy coding! 🐰

"""Create all skill .md files organized by category"""
import os

SKILLS_DIR = r'D:\nova\skills'

skills = {
    'software-dev/plan.md': {
        'desc': 'Enter plan mode -- write structured .md plans to .hermes/plans/',
        'triggers': ['plan', 'plan mode'],
        'tools': ['read', 'write', 'glob'],
    },
    'software-dev/skill-authoring.md': {
        'desc': 'Template and guide for creating new skills with proper YAML frontmatter',
        'triggers': ['skill authoring', 'create skill', 'new skill'],
        'tools': ['write', 'read', 'glob'],
    },
    'software-dev/rest-graphql-debug.md': {
        'desc': 'Debug REST and GraphQL APIs with detailed curl, Postman-like request crafting',
        'triggers': ['api debug', 'rest debug', 'graphql debug', 'curl'],
        'tools': ['read', 'write', 'bash'],
    },
    'software-dev/web-development.md': {
        'desc': 'Web development patterns -- HTML/CSS/JS, responsive design, accessibility',
        'triggers': ['web dev', 'html', 'css', 'frontend'],
        'tools': ['read', 'write', 'glob', 'grep'],
    },
    'software-dev/security.md': {
        'desc': 'Security audit and vulnerability scanning patterns for code and infrastructure',
        'triggers': ['security', 'audit', 'vulnerability', 'cve'],
        'tools': ['read', 'grep', 'glob', 'bash'],
    },
    'github/github-code-review.md': {
        'desc': 'Review GitHub PRs with inline comments via gh CLI or REST API',
        'triggers': ['github review', 'pr review', 'review pr'],
        'tools': ['read', 'grep', 'glob', 'bash'],
    },
    'github/github-auth.md': {
        'desc': 'Configure and manage GitHub authentication tokens and SSH keys',
        'triggers': ['github auth', 'github token', 'github ssh'],
        'tools': ['read', 'write', 'bash'],
    },
    'github/github-pr-workflow.md': {
        'desc': 'Full PR lifecycle: create, review, merge with conventional commits',
        'triggers': ['pr workflow', 'github pr', 'pull request'],
        'tools': ['read', 'write', 'bash', 'grep'],
    },
    'github/github-issues.md': {
        'desc': 'Manage GitHub issues via API -- create, list, update, close, label',
        'triggers': ['github issue', 'issues', 'bug report'],
        'tools': ['read', 'write', 'bash'],
    },
    'github/github-repo-management.md': {
        'desc': 'Manage GitHub repositories -- settings, collaborators, branches, workflows',
        'triggers': ['github repo', 'repo management', 'repository'],
        'tools': ['read', 'write', 'bash'],
    },
    'research/arxiv.md': {
        'desc': 'Search arXiv papers via API with curl/Python XML parsing',
        'triggers': ['arxiv', 'research paper', 'academic search'],
        'tools': ['read', 'bash'],
    },
    'research/research-paper-writing.md': {
        'desc': 'Structure and write academic research papers with AI assistance',
        'triggers': ['paper writing', 'academic writing', 'research paper'],
        'tools': ['read', 'write', 'glob'],
    },
    'research/llm-wiki.md': {
        'desc': 'Automatically build a wiki from LLM conversations and codebase analysis',
        'triggers': ['llm wiki', 'build wiki', 'documentation wiki'],
        'tools': ['read', 'write', 'glob', 'grep'],
    },
    'note-taking/obsidian.md': {
        'desc': 'Integrate with Obsidian vault -- create notes, link pages, manage knowledge',
        'triggers': ['obsidian', 'vault', 'notes', 'knowledge base'],
        'tools': ['read', 'write', 'glob'],
    },
    'creative/architecture-diagram.md': {
        'desc': 'Generate dark-theme SVG architecture diagrams with zero dependencies',
        'triggers': ['architecture diagram', 'svg diagram', 'system design'],
        'tools': ['read', 'write'],
    },
    'creative/excalidraw.md': {
        'desc': 'Create hand-drawn style diagrams using Excalidraw JSON format',
        'triggers': ['excalidraw', 'hand drawn', 'whiteboard'],
        'tools': ['write'],
    },
    'smart-home/openhue.md': {
        'desc': 'Control Philips Hue smart lights -- on/off, brightness, color, scenes',
        'triggers': ['openhue', 'philips hue', 'smart lights', 'hue'],
        'tools': ['bash'],
    },
    'media/spotify.md': {
        'desc': 'Spotify API -- playlists, playback control, search, recommendations',
        'triggers': ['spotify', 'playlist', 'music'],
        'tools': ['bash'],
    },
    'media/youtube-content.md': {
        'desc': 'YouTube Data API -- videos, playlists, transcripts, search',
        'triggers': ['youtube', 'video', 'transcript'],
        'tools': ['bash'],
    },
    'media/gif-search.md': {
        'desc': 'Search for GIFs using Tenor or GIPHY API -- useful in chat UI',
        'triggers': ['gif', 'gif search', 'tenor', 'giphy'],
        'tools': ['bash'],
    },
    'social-media/xurl.md': {
        'desc': 'X/Twitter API -- read tweets, post tweets, search, user info',
        'triggers': ['x', 'twitter', 'tweet', 'social'],
        'tools': ['bash'],
    },
    'data-science/jupyter-live-kernel.md': {
        'desc': 'Execute code in live Jupyter kernels -- Python, R, Julia notebooks',
        'triggers': ['jupyter', 'notebook', 'kernel', 'ipython'],
        'tools': ['bash', 'read', 'write'],
    },
    'mcp/native-mcp.md': {
        'desc': 'Integrate MCP (Model Context Protocol) servers with Nova agents',
        'triggers': ['mcp', 'model context protocol', 'mcp server'],
        'tools': ['read', 'write', 'bash'],
    },
    'email/himalaya.md': {
        'desc': 'Manage email via CLI using Himalaya -- send, read, search, tag',
        'triggers': ['himalaya', 'email cli', 'mail'],
        'tools': ['bash'],
    },
    'email/agentmail.md': {
        'desc': 'Send and receive emails via AgentMail API -- simple email as a service',
        'triggers': ['agentmail', 'email api'],
        'tools': ['bash'],
    },
    'productivity/google-workspace.md': {
        'desc': 'Google Workspace APIs -- Gmail, Docs, Sheets, Drive integration',
        'triggers': ['google workspace', 'gmail', 'google docs', 'google sheets', 'google drive'],
        'tools': ['bash', 'read', 'write'],
    },
    'productivity/linear.md': {
        'desc': 'Linear project management -- issues, sprints, teams, roadmaps',
        'triggers': ['linear', 'linear issues', 'project management'],
        'tools': ['bash'],
    },
    'productivity/airtable.md': {
        'desc': 'Airtable API -- bases, tables, records, views, automation',
        'triggers': ['airtable', 'database', 'spreadsheet'],
        'tools': ['bash'],
    },
    'productivity/powerpoint.md': {
        'desc': 'Generate PPTX presentations programmatically with python-pptx',
        'triggers': ['powerpoint', 'pptx', 'presentation', 'slides'],
        'tools': ['bash', 'write'],
    },
    'productivity/ocr-and-documents.md': {
        'desc': 'OCR on documents -- extract text, scanned PDFs, images via Tesseract',
        'triggers': ['ocr', 'document scan', 'text extraction', 'tesseract'],
        'tools': ['bash', 'read'],
    },
    'devops/kanban-orchestrator.md': {
        'desc': 'Orchestrate tasks in Kanban style -- backlogs, sprints, WIP limits',
        'triggers': ['kanban', 'orchestrate', 'task board', 'sprint'],
        'tools': ['read', 'write'],
    },
    'blockchain/evm.md': {
        'desc': 'Ethereum/EVM smart contracts -- deploy, interact, query, events',
        'triggers': ['evm', 'ethereum', 'smart contract', 'web3'],
        'tools': ['bash'],
    },
    'blockchain/solana.md': {
        'desc': 'Solana blockchain -- accounts, tokens, programs, transactions',
        'triggers': ['solana', 'sol', 'spl'],
        'tools': ['bash'],
    },
    'blockchain/hyperliquid.md': {
        'desc': 'Hyperliquid DEX -- perpetuals trading, order book, positions',
        'triggers': ['hyperliquid', 'perp', 'perpetuals', 'dex'],
        'tools': ['bash'],
    },
    'health/health.md': {
        'desc': 'Health and fitness tracking -- steps, sleep, water, workouts, nutrition',
        'triggers': ['health', 'fitness', 'workout', 'nutrition'],
        'tools': ['read', 'write'],
    },
    'finance/finance.md': {
        'desc': 'Financial data APIs -- stock prices, forex, crypto, economic indicators',
        'triggers': ['finance', 'stock', 'market', 'forex', 'economic'],
        'tools': ['bash'],
    },
    'sw-dev-opt/eslint.md': {
        'desc': 'Configure and run ESLint -- rules, plugins, auto-fix, custom configs',
        'triggers': ['eslint', 'lint', 'linting'],
        'tools': ['read', 'write', 'bash'],
    },
    'sw-dev-opt/prettier.md': {
        'desc': 'Format code with Prettier -- consistent style across the project',
        'triggers': ['prettier', 'format', 'code formatting'],
        'tools': ['read', 'write', 'bash'],
    },
    'sw-dev-opt/typescript.md': {
        'desc': 'TypeScript configuration and best practices -- strict mode, generics, types',
        'triggers': ['typescript', 'tsconfig', 'type safety'],
        'tools': ['read', 'write', 'bash'],
    },
    'community/community-download.md': {
        'desc': 'Download and install community-contributed skills from GitHub repos',
        'triggers': ['community skills', 'download skill', 'install skill', 'github skill'],
        'tools': ['read', 'write', 'bash', 'glob'],
    },
}

# Template body for each skill (will be enhanced per-category)
bodies = {
    'software-dev': """Follow the structured approach:

1. Understand the context and requirements
2. Break down into clear, actionable steps
3. Apply best practices and patterns
4. Verify the results before finishing
5. Document any important decisions or trade-offs
""",
    'github': """Work with GitHub using the gh CLI or REST API:

1. Verify GitHub authentication is configured
2. Use gh CLI for common operations
3. Fall back to REST API for advanced operations
4. Handle errors gracefully with clear messages
""",
    'research': """Research workflow:

1. Search and gather relevant sources
2. Read and analyze the content
3. Synthesize findings into structured output
4. Cite sources properly
""",
    'note-taking': """Create and manage notes:

1. Check if the note already exists
2. Use proper formatting and organization
3. Link related notes together
4. Add metadata for searchability
""",
    'creative': """Generate creative output:

1. Understand the requirements
2. Design with attention to aesthetics
3. Produce output in the requested format
4. Ensure it works without external dependencies
""",
    'smart-home': """Control smart home devices:

1. Verify device connectivity
2. Make safe state changes
3. Confirm the action was applied
4. Never change states without explicit user request
""",
    'media': """Work with media APIs:

1. Check API key is configured
2. Respect rate limits
3. Format output nicely
4. Cache results when appropriate
""",
    'social-media': """Interact with social media:

1. Check authentication is configured
2. Read-only operations by default
3. Confirm before posting any content
4. Respect platform rate limits
""",
    'data-science': """Data science operations:

1. Start with data exploration
2. Create reproducible workflows
3. Document assumptions and parameters
4. Visualize results when possible
""",
    'mcp': """MCP (Model Context Protocol) integration:

1. Check which MCP servers are available
2. Use existing servers when possible
3. Provide guidance for new server setup
4. Ensure security best practices
""",
    'email': """Email operations:

1. Check email service is configured
2. Never expose email credentials
3. Ask before sending any email
4. Format emails professionally
""",
    'productivity': """Productivity workflow:

1. Check service authentication
2. Understand the data model
3. Perform the requested operation
4. Format results clearly
""",
    'devops': """DevOps orchestration:

1. Assess current state
2. Plan the workflow
3. Execute step by step
4. Monitor and report progress
""",
    'blockchain': """Blockchain operations:

1. Connect to the appropriate network
2. Read-only queries by default
3. Confirm before any transaction
4. Never expose private keys
5. Test on testnet first
""",
    'health': """Health tracking:

1. Read existing health data
2. Update with new entries
3. Generate summaries and insights
4. All data stored locally
""",
    'finance': """Finance data operations:

1. Fetch current data from APIs
2. Respect rate limits
3. Present data clearly with context
4. Note data freshness/timestamp
""",
    'sw-dev-opt': """Development tool optimization:

1. Check current configuration
2. Apply best practices
3. Verify the configuration works
4. Document any breaking changes
""",
    'community': """Community skill management:

1. Search available skill sources
2. Download and validate skills
3. Install to the correct category
4. Verify the skill loads correctly
""",
}

# Map file paths to categories
def get_category(path):
    parts = path.split('/')
    if len(parts) >= 2:
        return parts[0]
    return 'software-dev'

for path, data in skills.items():
    fp = os.path.join(SKILLS_DIR, path)
    os.makedirs(os.path.dirname(fp), exist_ok=True)
    
    cat = get_category(path)
    body = bodies.get(cat, bodies['software-dev'])
    
    triggers_str = ', '.join(f'"{t}"' for t in data['triggers'])
    tools_str = ', '.join(f'"{t}"' for t in data['tools'])
    
    content = f"""---
description: {data['desc']}
triggers: [{triggers_str}]
tools: [{tools_str}]
---
{body.strip()}
"""
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'OK: {path}')

print(f'\nDone: {len(skills)} files')

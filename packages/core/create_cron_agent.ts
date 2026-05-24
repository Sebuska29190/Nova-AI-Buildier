import { agentStore } from './src/agent/store.ts';

// Initialize the DB first - it's already initialized by imports
async function main() {
  try {
    const existing = agentStore.get('cron-worker');
    if (existing) {
      console.log('Agent cron-worker already exists:', existing.name, existing.modelRef);
      process.exit(0);
    }
    
    const agent = agentStore.create({
      name: 'Cron Worker',
      description: 'Default agent for scheduled cron tasks',
      modelRef: 'deepseek/deepseek-chat',
      systemPrompt: 'You are a Nova cron worker. Execute the assigned task using available tools.',
      emoji: '⏰',
    });
    console.log('Created cron-worker:', agent.id, agent.modelRef);
  } catch(e) {
    console.error('Error:', e instanceof Error ? e.message : e);
  }
}
main();

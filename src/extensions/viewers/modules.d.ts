declare module 'markdown-it-task-lists' {
  const taskLists: (
    md: InstanceType<typeof import('markdown-it').default>,
    options?: { enabled?: boolean; label?: boolean; labelAfter?: boolean },
  ) => void;
  export default taskLists;
}

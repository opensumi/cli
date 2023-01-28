module.exports = {
  move: {
    _gitignore: '.gitignore',
    _vscodeignore: '.vscodeignore',
    _sumiignore: '.sumiignore',
  },
  questions: [
    {
      type: 'input',
      name: 'name',
      message: '请输入插件名称',
      validate(value) {
        if (!value) {
          return '插件名不能为空';
        }
        return true;
      },
      filter(value) {
        return value.trim();
      },
    },
    {
      type: 'input',
      name: 'publisher',
      message: '请输入插件 publisher，package.json 中的 publisher 字段',
      validate(value) {
        if (!value) {
          return '插件 publisher 不能为空';
        }
        return true;
      },
      filter(value) {
        return value.trim();
      },
    },
    {
      type: 'input',
      name: 'displayName',
      message: '请输入插件要显示的名称?',
    },
    {
      type: 'input',
      name: 'description',
      message: '请输入插件描述',
    },
  ],
};

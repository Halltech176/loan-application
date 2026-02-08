module.exports = function (plop) {
  plop.setGenerator('module', {
    description: 'Create a new module',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Module name (e.g., loan-application):',
      },
    ],
    actions: [
      {
        type: 'add',
        path: 'src/modules/{{dashCase name}}/{{dashCase name}}.model.ts',
        templateFile: 'plopfiles/templates/model.hbs',
      },
      {
        type: 'add',
        path: 'src/modules/{{dashCase name}}/{{dashCase name}}.repository.ts',
        templateFile: 'plopfiles/templates/repository.hbs',
      },
      {
        type: 'add',
        path: 'src/modules/{{dashCase name}}/{{dashCase name}}.service.ts',
        templateFile: 'plopfiles/templates/service.hbs',
      },
      {
        type: 'add',
        path: 'src/modules/{{dashCase name}}/{{dashCase name}}.controller.ts',
        templateFile: 'plopfiles/templates/controller.hbs',
      },
      {
        type: 'add',
        path: 'src/modules/{{dashCase name}}/{{dashCase name}}.routes.ts',
        templateFile: 'plopfiles/templates/routes.hbs',
      },
      {
        type: 'add',
        path: 'src/modules/{{dashCase name}}/dto/{{dashCase name}}.dto.ts',
        templateFile: 'plopfiles/templates/dto.hbs',
      },
    ],
  });
};

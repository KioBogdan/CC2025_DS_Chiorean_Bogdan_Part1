import { Amplify } from "aws-amplify";

export function configureAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID,
        userPoolClientId: process.env.REACT_APP_COGNITO_CLIENT_ID,
        region: process.env.REACT_APP_AWS_REGION, // AWS userPoolID's region
      },
    },
  });
}

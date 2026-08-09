import { Redirect } from 'expo-router';

/*
  Cold start always lands on the login screen (mockup behavior). It offers
  biometric unlock when an identity is saved, nsec login, or browsing
  without an identity.
*/
export default function Index() {
  return <Redirect href="/login" />;
}

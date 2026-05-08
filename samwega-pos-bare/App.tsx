import React, { useRef } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import RegistrationScreen from './src/screens/RegistrationScreen';
import WaitingVerificationScreen from './src/screens/WaitingVerificationScreen';
import StockScreen from './src/screens/StockScreen';
import IssuanceConfirmationScreen from './src/screens/IssuanceConfirmationScreen';
import SalesScreen from './src/screens/SalesScreen';
import SalesDashboardScreen from './src/screens/SalesDashboardScreen';
import SalesListScreen from './src/screens/SalesListScreen';
import SaleDetailsScreen from './src/screens/SaleDetailsScreen';
import ExpensesScreen from './src/screens/ExpensesScreen';
import RecordExpenseScreen from './src/screens/RecordExpenseScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import ReportPreviewScreen from './src/screens/ReportPreviewScreen';
import SessionProvider from './src/providers/SessionProvider';
import { LogBox } from 'react-native';

// Suppress known warnings that are noisy but harmless for this session
LogBox.ignoreLogs([
  '`new NativeEventEmitter()` was called with a non-null argument',
]);

const Stack = createNativeStackNavigator();

const App = () => {
  const navigationRef = useNavigationContainerRef();

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <SessionProvider navigation={navigationRef}>
          <Stack.Navigator initialRouteName="Login">
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Registration"
              component={RegistrationScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="WaitingVerification"
              component={WaitingVerificationScreen}
              options={{ headerShown: false, gestureEnabled: false }}
            />
            <Stack.Screen
              name="Stock"
              component={StockScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="IssuanceConfirmation"
              component={IssuanceConfirmationScreen}
              options={{ title: 'Confirm Collection' }}
            />
            <Stack.Screen
              name="SalesDashboard"
              component={SalesDashboardScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Sales"
              component={SalesScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SalesList"
              component={SalesListScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SaleDetails"
              component={SaleDetailsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Expenses"
              component={ExpensesScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="RecordExpense"
              component={RecordExpenseScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Reports"
              component={ReportsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ReportPreview"
              component={ReportPreviewScreen}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        </SessionProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;

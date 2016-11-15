/**
 * Created by jason on 2016/11/13.
 */
import dotenv from 'dotenv'

dotenv.config({silent: true})

export const {
  SSID,
  PSK,
  INNER_INTERFACE_NAME,
  OUTER_INTERFACE_NAME,
  TEST_GATEWAY,
  LOCAL_GATEWAY,
  ROUTER_GATEWAY
} = process.env
